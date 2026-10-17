import { Hono } from "hono";
import { expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import {
  describeRoute,
  loadVendor,
  resolver,
  validator,
} from "../middlewares.js";
import { componentRefs } from "../references.js";

it("literal example data does not retain a schema from a hidden route", async () => {
  const Hidden = z.object({ privateField: z.string() }).meta({ ref: "Hidden" });
  const app = new Hono()
    .post(
      "/hidden",
      describeRoute({ hide: true }),
      validator("json", Hidden),
      (c) => c.json({}),
    )
    .get(
      "/visible",
      describeRoute({
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { type: "object" },
                example: { $ref: "#/components/schemas/Hidden" },
              },
            },
          },
        },
      }),
      (c) => c.json({}),
    );
  const doc = await generateSpecs(app);
  expect(doc.paths["/hidden"]).toBeUndefined();
  expect(doc.components?.schemas?.Hidden).toBeUndefined();
});
it.each(["Child", "#/components/schemas/Child"])(
  "follows a split child referenced only by discriminator mapping %s",
  async (target) => {
    const vendor = `mapping-${target}`;
    const standard = {
      "~standard": {
        version: 1 as const,
        vendor,
        validate: (value: unknown) => ({ value }),
      },
    };
    loadVendor(vendor, {
      toOpenAPISchema: (_schema, context) => {
        const output = context.options?.output === true;
        context.components.schemas = {
          Parent: {
            type: "object",
            properties: { kind: { type: "string" } },
            required: ["kind"],
            discriminator: {
              propertyName: "kind",
              mapping: {
                child: target,
                external: "https://example.com/other.json#/Child",
              },
            },
          },
          Child: {
            allOf: [
              { $ref: "#/components/schemas/Parent" },
              {
                type: "object",
                properties: { count: { type: "number", default: 1 } },
                ...(output ? { required: ["count"] } : {}),
              },
            ],
          },
        };
        return { $ref: "#/components/schemas/Parent" };
      },
    });
    const app = new Hono().post(
      "/x",
      validator("json", standard),
      describeRoute({
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: resolver(standard, { options: { output: true } }),
              },
            },
          },
        },
      }),
      (c) => c.json({}),
    );
    const doc = await generateSpecs(app);
    expect(doc.components?.schemas).toMatchObject({
      Parent: { discriminator: { mapping: { child: target } } },
      ParentOutput: {
        discriminator: {
          mapping: {
            child:
              target === "Child"
                ? "ChildOutput"
                : "#/components/schemas/ChildOutput",
            external: "https://example.com/other.json#/Child",
          },
        },
      },
      ChildOutput: {
        allOf: [
          { $ref: "#/components/schemas/ParentOutput" },
          {
            type: "object",
            properties: { count: { type: "number", default: 1 } },
            required: ["count"],
          },
        ],
      },
    });
  },
);

it("collects Example Object references without treating their values as references", () => {
  expect(
    componentRefs({
      components: {
        schemas: { example: { $ref: "#/components/schemas/Actual" } },
      },
      content: {
        "application/json": {
          examples: {
            example: { $ref: "#/components/examples/Sample" },
            literal: { value: { $ref: "#/components/schemas/Hidden" } },
          },
          schema: {
            examples: [{ $ref: "#/components/schemas/Hidden" }],
            default: { $ref: "#/components/schemas/Hidden" },
            enum: [{ $ref: "#/components/schemas/Hidden" }],
            const: { $ref: "#/components/schemas/Hidden" },
            "x-data": { $ref: "#/components/schemas/Hidden" },
            properties: { default: { $ref: "#/components/schemas/Property" } },
          },
        },
      },
    }),
  ).toEqual(["schemas/Actual", "examples/Sample", "schemas/Property"]);
});
