import { Schema } from "effect";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver } from "../middlewares.js";

describe("issue-227", () => {
  it("lifts $defs into components.schemas when the top-level schema is not a $ref", async () => {
    class Bar extends Schema.Class<Bar>("Bar")({
      baz: Schema.Number,
    }) {}

    class Foo extends Schema.Class<Foo>("Foo")({
      bar: Schema.optional(Bar),
    }) {}

    class Item extends Schema.Class<Item>("Item")({
      foo: Foo,
      id: Schema.String,
      createdAt: Schema.DateTimeUtc,
    }) {}

    const app = new Hono().get(
      "/",
      describeRoute({
        operationId: "lists.list",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: resolver(
                  Schema.Array(Item).pipe(Schema.standardSchemaV1),
                ),
              },
            },
          },
        },
      }),
      async (c) => c.body(null, 204),
    );

    const specs = await generateSpecs(app);

    const responseSchema =
      // biome-ignore lint/suspicious/noExplicitAny: test assertion
      (specs.paths?.["/"]?.get?.responses?.["200"] as any).content[
        "application/json"
      ].schema;

    // The response schema should reference components, not embed $defs inline
    expect(responseSchema.$defs).toBeUndefined();
    expect(responseSchema).toEqual({
      type: "array",
      items: { $ref: "#/components/schemas/Item" },
    });

    // The extracted schemas must live under components.schemas
    expect(specs.components?.schemas).toBeDefined();
    expect(Object.keys(specs.components?.schemas ?? {})).toEqual(
      expect.arrayContaining(["Item", "Foo", "Bar"]),
    );
  });
});
