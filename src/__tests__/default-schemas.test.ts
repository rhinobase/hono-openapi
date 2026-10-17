import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

const Body = z.object({ name: z.string() });
const Result = z
  .object({ count: z.number().default(1) })
  .meta({ ref: "Result" });

describe("schemas in method defaults", () => {
  it.each(["describeRoute first", "validator first", "validator only"])(
    "resolves default responses for %s routes",
    async (order) => {
      const app = new Hono();
      const validate = validator("json", Body);
      const describe = describeRoute({ summary: "Create a record" });
      const middleware =
        order === "validator only"
          ? [validate]
          : order === "describeRoute first"
            ? [describe, validate]
            : [validate, describe];
      app.post("/records", ...middleware, (c) => c.json({ count: 1 }));
      const doc = await generateSpecs(app, {
        defaultOptions: {
          POST: {
            responses: {
              200: {
                description: "OK",
                headers: { "X-Result": { schema: resolver(Result) } },
                content: {
                  "application/json": { schema: resolver(Result) },
                },
              },
            },
          },
        },
      });
      expect(doc.paths["/records"]?.post?.responses?.[200]).toMatchObject({
        headers: {
          "X-Result": { schema: { $ref: "#/components/schemas/Result" } },
        },
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Result" },
          },
        },
      });
      expect(doc.components?.schemas?.Result).toMatchObject({
        required: ["count"],
      });
    },
  );

  it("resolves default request media as input while keeping the validator schema", async () => {
    const app = new Hono().post(
      "/records",
      validator("json", Body),
      describeRoute({ summary: "Create" }),
      (c) => c.json({}),
    );
    const doc = await generateSpecs(app, {
      defaultOptions: {
        POST: {
          requestBody: {
            content: {
              "application/vnd.record+json": { schema: resolver(Result) },
            },
          },
          responses: {
            200: {
              description: "OK",
              content: { "application/json": { schema: resolver(Result) } },
            },
          },
        },
      },
    });
    expect(doc.paths["/records"]?.post?.requestBody).toMatchObject({
      content: {
        "application/vnd.record+json": {
          schema: { $ref: "#/components/schemas/Result" },
        },
        "application/json": { schema: { type: "object", required: ["name"] } },
      },
    });
    expect(doc.components?.schemas?.Result).toMatchObject({
      properties: { count: { type: "number", default: 1 } },
    });
    expect(doc.components?.schemas?.Result).not.toHaveProperty("required");
    expect(doc.components?.schemas?.ResultOutput).toMatchObject({
      required: ["count"],
    });
    expect(doc.paths["/records"]?.post?.responses?.[200]).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ResultOutput" },
        },
      },
    });
  });
});

it.each([true, false])(
  "preserves a literal boolean body schema %s",
  async (schema) => {
    // Boolean schemas are valid JSON Schema but absent from openapi-types.
    const content = { "application/json": { schema } } as never;
    const app = new Hono().get(
      "/anything",
      describeRoute({
        responses: {
          200: {
            description: "OK",
            content,
          },
        },
      }),
      (c) => c.json({}),
    );
    expect(
      (await generateSpecs(app)).paths["/anything"]?.get?.responses?.[200],
    ).toMatchObject({
      content: { "application/json": { schema } },
    });
  },
);
