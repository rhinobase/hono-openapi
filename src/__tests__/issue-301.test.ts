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
import type { GenerateSpecOptions } from "../types.js";

const Tag = z.object({ label: z.string() }).meta({ ref: "Tag" });
const Pet = z.object({ name: z.string(), tag: Tag }).meta({ ref: "Pet" });
const Visit = z
  .object({ notes: z.string().default("") })
  .meta({ ref: "Visit" });

const echo = (
  schema: StandardSchemaV1,
  path: string,
  options?: Record<string, unknown>,
) =>
  new Hono().post(
    path,
    describeRoute({
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(schema, options) },
          },
        },
      },
    }),
    validator("json", schema),
    (c) => c.json(c.req.valid("json")),
  );

const app = new Hono()
  .route("/", echo(Pet, "/pets"))
  .route("/", echo(Visit, "/visits"));

const generate = (options: Partial<GenerateSpecOptions> = {}) =>
  generateSpecs(app, options);

const responseRef = (
  specs: Awaited<ReturnType<typeof generateSpecs>>,
  path: string,
) =>
  (
    specs.paths[path]?.post?.responses?.[200] as {
      content: { "application/json": { schema: { $ref: string } } };
    }
  ).content["application/json"].schema.$ref;

describe("ignoreClosedOutputs", () => {
  it("gives a closed output form its own component by default", async () => {
    const specs = await generate();

    expect(Object.keys(specs.components?.schemas ?? {})).toEqual(
      expect.arrayContaining(["Pet", "PetOutput", "Tag", "TagOutput"]),
    );
    expect(responseRef(specs, "/pets")).toBe("#/components/schemas/PetOutput");
  });

  it("shares the request's component when the output only closes it", async () => {
    const specs = await generate({ ignoreClosedOutputs: true });
    const schemas = Object.keys(specs.components?.schemas ?? {});

    expect(schemas).toEqual(expect.arrayContaining(["Pet", "Tag"]));
    expect(schemas).not.toEqual(expect.arrayContaining(["PetOutput"]));
    expect(schemas).not.toEqual(expect.arrayContaining(["TagOutput"]));
    expect(responseRef(specs, "/pets")).toBe("#/components/schemas/Pet");
  });

  it("still splits an output form that differs in more", async () => {
    const specs = await generate({ ignoreClosedOutputs: true });

    expect(responseRef(specs, "/visits")).toBe(
      "#/components/schemas/VisitOutput",
    );
    expect(specs.components?.schemas?.VisitOutput).toMatchObject({
      additionalProperties: false,
      required: ["notes"],
    });
  });
});

type Schemas = Record<string, OpenAPIV3_1.SchemaObject>;

// A schema whose request and response forms are given as components, the
// first of which is the one the route refers to.
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

const generateForms = (vendor: string, input: Schemas, output: Schemas) =>
  generateSpecs(
    echo(forms(vendor, input, output), "/notes", {
      options: { output: true },
    }),
    { ignoreClosedOutputs: true },
  );

describe("ignoreClosedOutputs with closures that don't only widen", () => {
  it.each<[string, OpenAPIV3_1.SchemaObject, OpenAPIV3_1.SchemaObject]>([
    ["under `not`", { not: open }, { not: closed }],
    [
      "under `not` in a property",
      { properties: { body: { not: open } }, type: "object" },
      { properties: { body: { not: closed } }, type: "object" },
    ],
    [
      "in an `if`",
      { else: { type: "string" }, if: open },
      { else: { type: "string" }, if: closed },
    ],
    ["in a `oneOf`", { oneOf: [open, true] }, { oneOf: [closed, true] }],
    [
      "in a `contains` with a `maxContains`",
      { contains: open, maxContains: 1, type: "array" },
      { contains: closed, maxContains: 1, type: "array" },
    ],
    ["where only the request's form is closed", closed, open],
  ])("keeps a closure %s apart", async (description, input, output) => {
    const specs = await generateForms(
      `closure ${description}`,
      { Note: input },
      { Note: output },
    );

    expect(responseRef(specs, "/notes")).toBe(
      "#/components/schemas/NoteOutput",
    );
    expect(specs.components?.schemas).toMatchObject({
      Note: input,
      NoteOutput: output,
    });
  });

  it("keeps a component referred to under `not` apart", async () => {
    const specs = await generateForms(
      "closure referred to under not",
      {
        Note: { not: { $ref: "#/components/schemas/Tag" } },
        Tag: open,
      },
      {
        Note: { not: { $ref: "#/components/schemas/Tag" } },
        Tag: closed,
      },
    );

    expect(responseRef(specs, "/notes")).toBe(
      "#/components/schemas/NoteOutput",
    );
    expect(specs.components?.schemas).toMatchObject({
      NoteOutput: { not: { $ref: "#/components/schemas/TagOutput" } },
      Tag: open,
      TagOutput: closed,
    });
  });

  it.each<[string, OpenAPIV3_1.SchemaObject, OpenAPIV3_1.SchemaObject]>([
    ["under `not` twice", { not: { not: open } }, { not: { not: closed } }],
    [
      "in a `then` and an `else`",
      // biome-ignore lint/suspicious/noThenProperty: a JSON Schema keyword
      { else: open, if: { type: "object" }, then: open },
      // biome-ignore lint/suspicious/noThenProperty: a JSON Schema keyword
      { else: closed, if: { type: "object" }, then: closed },
    ],
    [
      "in a `contains` without a `maxContains`",
      { contains: open, type: "array" },
      { contains: closed, type: "array" },
    ],
  ])(
    "shares a component with a closure %s",
    async (description, input, output) => {
      const specs = await generateForms(
        `closure ${description}`,
        { Note: input },
        { Note: output },
      );

      expect(responseRef(specs, "/notes")).toBe("#/components/schemas/Note");
      expect(specs.components?.schemas).toEqual({ Note: input });
    },
  );
});
