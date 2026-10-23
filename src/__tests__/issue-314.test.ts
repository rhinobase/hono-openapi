import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

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
