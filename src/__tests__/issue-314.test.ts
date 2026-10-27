import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Hono } from "hono";
import type { OpenAPIV3_1 } from "openapi-types";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import {
  describeRoute,
  loadVendor,
  resolver,
  validator,
} from "../middlewares.js";

const app = new Hono().get("/pets", (c) => c.json([]));

describe("webhook resolvers", () => {
  it("converts a resolver() in a webhook's request body", async () => {
    const specs = await generateSpecs(app, {
      documentation: {
        webhooks: {
          "pet.adopted": {
            post: {
              requestBody: {
                content: {
                  "application/json": {
                    schema: resolver(
                      z.object({ adoptedAt: z.string(), petId: z.string() }),
                    ),
                  },
                },
              },
              responses: { 200: { description: "Received" } },
            },
          },
        },
      },
    });

    expect(specs.webhooks?.["pet.adopted"]).toEqual({
      post: {
        requestBody: {
          content: {
            "application/json": {
              // Converted as output, as a response is: what the API sends.
              schema: {
                additionalProperties: false,
                properties: {
                  adoptedAt: { type: "string" },
                  petId: { type: "string" },
                },
                required: ["adoptedAt", "petId"],
                type: "object",
              },
            },
          },
        },
        responses: { 200: { description: "Received" } },
      },
    });
  });

  it("documents a named schema as a component the webhook refers to", async () => {
    const PetAdopted = z
      .object({ petId: z.string() })
      .meta({ ref: "PetAdopted" });

    const specs = await generateSpecs(app, {
      documentation: {
        webhooks: {
          "pet.adopted": {
            post: {
              requestBody: {
                content: {
                  "application/json": { schema: resolver(PetAdopted) },
                },
              },
            },
          },
        },
      },
    });

    expect(
      specs.webhooks?.["pet.adopted"] &&
        "post" in specs.webhooks["pet.adopted"] &&
        specs.webhooks["pet.adopted"].post?.requestBody,
    ).toEqual({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/PetAdopted" },
        },
      },
    });
    expect(specs.components?.schemas?.PetAdopted).toEqual({
      additionalProperties: false,
      properties: { petId: { type: "string" } },
      required: ["petId"],
      type: "object",
    });
  });

  it("describes what the webhook sends, apart from what a route accepts", async () => {
    // A default makes the field optional in what a route accepts, and always
    // present in what the API sends.
    const Pet = z
      .object({ name: z.string(), status: z.string().default("available") })
      .meta({ ref: "Pet" });
    const routes = new Hono().post(
      "/pets",
      describeRoute({}),
      validator("json", Pet),
      (c) => c.json({}),
    );

    const specs = await generateSpecs(routes, {
      documentation: {
        webhooks: {
          "pet.created": {
            post: {
              requestBody: {
                content: { "application/json": { schema: resolver(Pet) } },
              },
            },
          },
        },
      },
    });

    const webhook = specs.webhooks?.["pet.created"];
    expect(webhook && "post" in webhook && webhook.post?.requestBody).toEqual({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/PetOutput" },
        },
      },
    });
    expect(specs.components?.schemas?.Pet?.required).toEqual(["name"]);
    expect(specs.components?.schemas?.PetOutput?.required).toEqual([
      "name",
      "status",
    ]);
  });

  it("converts a resolver() in a webhook's response as what the receiver sends", async () => {
    const specs = await generateSpecs(app, {
      documentation: {
        webhooks: {
          "pet.adopted": {
            post: {
              responses: {
                200: {
                  content: {
                    "application/json": {
                      schema: resolver(z.object({ received: z.boolean() })),
                    },
                  },
                  description: "Received",
                },
              },
            },
          },
        },
      },
    });

    const webhook = specs.webhooks?.["pet.adopted"];
    expect(webhook && "post" in webhook && webhook.post?.responses).toEqual({
      200: {
        content: {
          "application/json": {
            schema: {
              properties: { received: { type: "boolean" } },
              required: ["received"],
              type: "object",
            },
          },
        },
        description: "Received",
      },
    });
  });
});

type Schemas = Record<string, OpenAPIV3_1.SchemaObject>;

// A schema whose request and response forms are given as components, the
// first of which is the one the route or webhook refers to.
const forms = (vendor: string, input: Schemas, output: Schemas) => {
  const schema: StandardSchemaV1 = {
    "~standard": {
      validate: (value) => ({ value }),
      vendor,
      version: 1,
    },
  };
  loadVendor(vendor, {
    toOpenAPISchema: (_schema, context) => {
      const components = context.options?.output === true ? output : input;
      context.components.schemas = components;
      return {
        $ref: `#/components/schemas/${Object.keys(components)[0]}`,
      };
    },
  });
  return schema;
};

const closed = {
  additionalProperties: false,
  properties: { name: { type: "string" } },
  type: "object",
} satisfies OpenAPIV3_1.SchemaObject;
const { additionalProperties: _, ...open } = closed;
const tagRef = { $ref: "#/components/schemas/Tag" };
const tagOutputRef = { $ref: "#/components/schemas/TagOutput" };

const json = (schema: StandardSchemaV1) => ({
  content: {
    "application/json": {
      schema: resolver(schema, { options: { output: true } }),
    },
  },
});

// A route accepts the Note a webhook sends; another route sends `tags` if
// given.
const sendNote = (note: StandardSchemaV1, tags?: StandardSchemaV1) => {
  const routes = new Hono().post(
    "/notes",
    describeRoute({}),
    validator("json", note),
    (c) => c.json({}),
  );
  return generateSpecs(
    tags
      ? routes.get(
          "/tags",
          describeRoute({
            responses: { 200: { ...json(tags), description: "OK" } },
          }),
          (c) => c.json({}),
        )
      : routes,
    {
      documentation: {
        webhooks: { "note.created": { post: { requestBody: json(note) } } },
      },
      ignoreClosedOutputs: true,
    },
  );
};

const webhookRef = (specs: Awaited<ReturnType<typeof generateSpecs>>) => {
  const webhook = specs.webhooks?.["note.created"];
  return (
    webhook &&
    "post" in webhook &&
    (
      webhook.post?.requestBody as {
        content: { "application/json": { schema: { $ref: string } } };
      }
    ).content["application/json"].schema.$ref
  );
};

describe("webhook resolvers with ignoreClosedOutputs", () => {
  it.each<[string, OpenAPIV3_1.SchemaObject, OpenAPIV3_1.SchemaObject]>([
    ["under `not`", { not: tagRef }, { not: tagOutputRef }],
    [
      "in a `oneOf`",
      { oneOf: [tagRef, true] },
      { oneOf: [tagOutputRef, true] },
    ],
    [
      "in an `if`",
      { else: { type: "string" }, if: tagRef },
      { else: { type: "string" }, if: tagOutputRef },
    ],
  ])(
    "keeps a closure a webhook refers to %s apart",
    async (description, note, noteOutput) => {
      const specs = await sendNote(
        forms(
          `webhook closure ${description}`,
          { Note: note, Tag: open },
          { Note: note, Tag: closed },
        ),
      );

      expect(webhookRef(specs)).toBe("#/components/schemas/NoteOutput");
      expect(specs.components?.schemas).toEqual({
        Note: note,
        NoteOutput: noteOutput,
        Tag: open,
        TagOutput: closed,
      });
    },
  );

  it("keeps a closure apart that a route sends and a webhook refers to under `not`", async () => {
    const specs = await sendNote(
      forms(
        "webhook closure under not, sent by a route",
        { Note: { not: tagRef }, Tag: open },
        { Note: { not: tagRef }, Tag: closed },
      ),
      forms("tag sent by a route", { Tag: open }, { Tag: closed }),
    );

    expect(webhookRef(specs)).toBe("#/components/schemas/NoteOutput");
    expect(
      (
        specs.paths["/tags"]?.get?.responses?.[200] as {
          content: { "application/json": { schema: { $ref: string } } };
        }
      ).content["application/json"].schema.$ref,
    ).toBe("#/components/schemas/TagOutput");
    expect(specs.components?.schemas?.TagOutput).toEqual(closed);
  });

  it("shares a component a webhook refers to only where opening it widens what it sends", async () => {
    const note = { allOf: [tagRef] };
    const specs = await sendNote(
      forms(
        "webhook closure in an allOf",
        { Note: note, Tag: open },
        { Note: note, Tag: closed },
      ),
    );

    expect(webhookRef(specs)).toBe("#/components/schemas/Note");
    expect(specs.components?.schemas).toEqual({ Note: note, Tag: open });
  });
});
