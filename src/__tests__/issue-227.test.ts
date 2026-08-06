import { Schema } from "effect";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

// biome-ignore lint/suspicious/noExplicitAny: test assertion helpers
type AnyObj = any;

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

    const responseSchema = (
      specs.paths?.["/"]?.get?.responses?.["200"] as AnyObj
    ).content["application/json"].schema;

    // The response schema should reference components, not embed $defs inline
    expect(responseSchema.$defs).toBeUndefined();
    expect(responseSchema).toEqual({
      type: "array",
      items: { $ref: "#/components/schemas/Item" },
    });

    // The extracted schemas must live under components.schemas
    const schemas = specs.components?.schemas ?? {};
    expect(Object.keys(schemas)).toEqual(
      expect.arrayContaining(["Item", "Foo", "Bar", "DateTimeUtc"]),
    );

    // The lifted definitions must be the real converted schemas, not $ref stubs
    expect(schemas.Item).toMatchObject({ type: "object" });
    expect((schemas.Item as AnyObj).properties.foo).toEqual({
      $ref: "#/components/schemas/Foo",
    });
    expect(schemas.Bar).toMatchObject({
      type: "object",
      properties: { baz: { type: "number" } },
    });

    // Every $ref used in the spec must resolve to a defined component
    for (const ref of collectRefs(specs)) {
      const name = ref.replace("#/components/schemas/", "");
      expect(schemas[name], `dangling $ref: ${ref}`).toBeDefined();
    }
  });

  it("does not clobber real components with $ref stubs when schemas are ref-annotated", async () => {
    // When schemas carry a `ref`/`$id` annotation the upstream converter
    // registers the real definition under components.schemas but ALSO leaves
    // a self-referential stub (`{ $ref }`) inside the top-level $defs. The
    // lift must let the real components win, not the stub.
    class Bar extends Schema.Class<Bar>("Bar")(
      { baz: Schema.Number },
      { jsonSchema: { ref: "Bar" } },
    ) {}

    class Item extends Schema.Class<Item>("Item")(
      {
        bar: Bar,
        createdAt: Schema.DateTimeUtc.pipe(
          Schema.annotations({ jsonSchema: { ref: "DateTimeUtc" } }),
        ),
      },
      { jsonSchema: { ref: "Item" } },
    ) {}

    const app = new Hono().get(
      "/",
      describeRoute({
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
    const schemas = specs.components?.schemas ?? {};

    // Real object definitions, not `{ $ref: ... }` stubs
    expect(schemas.Item).toMatchObject({ type: "object" });
    expect(schemas.Bar).toMatchObject({
      type: "object",
      properties: { baz: { type: "number" } },
    });
    expect((schemas.Item as AnyObj).$ref).toBeUndefined();
    expect((schemas.Bar as AnyObj).$ref).toBeUndefined();

    const responseSchema = (
      specs.paths?.["/"]?.get?.responses?.["200"] as AnyObj
    ).content["application/json"].schema;
    expect(responseSchema.$defs).toBeUndefined();
  });

  it("lifts $defs for validator() request bodies", async () => {
    class Address extends Schema.Class<Address>("Address")({
      city: Schema.String,
    }) {}

    class User extends Schema.Class<User>("User")({
      name: Schema.String,
      address: Address,
    }) {}

    // An array request body makes the top-level schema a non-$ref, which is
    // the case that produces a leftover top-level $defs (see #227). A bare
    // `User` would already be emitted as a top-level `$ref` by the vendor.
    const app = new Hono().post(
      "/users",
      validator("json", Schema.Array(User).pipe(Schema.standardSchemaV1)),
      async (c) => c.json({ ok: true }),
    );

    const specs = await generateSpecs(app);

    const requestSchema = (specs.paths?.["/users"]?.post as AnyObj).requestBody
      .content["application/json"].schema;

    expect(requestSchema.$defs).toBeUndefined();
    expect(requestSchema).toEqual({
      type: "array",
      items: { $ref: "#/components/schemas/User" },
    });

    const schemas = specs.components?.schemas ?? {};
    expect(Object.keys(schemas)).toEqual(
      expect.arrayContaining(["User", "Address"]),
    );

    for (const ref of collectRefs(specs)) {
      const name = ref.replace("#/components/schemas/", "");
      expect(schemas[name], `dangling $ref: ${ref}`).toBeDefined();
    }
  });

  it("lifts $defs for query/param validators without leaking $defs into parameters", async () => {
    const app = new Hono().get(
      "/search",
      validator(
        "query",
        Schema.standardSchemaV1(
          Schema.Struct({
            q: Schema.String,
            when: Schema.DateTimeUtc.pipe(
              Schema.annotations({ jsonSchema: { ref: "When" } }),
            ),
          }),
        ),
      ),
      async (c) => c.json({ ok: true }),
    );

    const specs = await generateSpecs(app);

    const params = (specs.paths?.["/search"]?.get as AnyObj).parameters;
    expect(Array.isArray(params)).toBe(true);

    // No parameter object should carry a stray $defs
    for (const p of params) {
      expect(p.$defs).toBeUndefined();
      expect(p.schema?.$defs).toBeUndefined();
    }

    // The query params were generated
    const names = params.map((p: AnyObj) => p.name);
    expect(names).toEqual(expect.arrayContaining(["q", "when"]));
  });

  it("is a no-op for vendors that already emit components (no regression for Zod)", async () => {
    const User = z.object({ name: z.string() }).meta({ ref: "User" });

    const app = new Hono().get(
      "/",
      describeRoute({
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": { schema: resolver(User) },
            },
          },
        },
      }),
      async (c) => c.body(null, 204),
    );

    const specs = await generateSpecs(app);
    const responseSchema = (
      specs.paths?.["/"]?.get?.responses?.["200"] as AnyObj
    ).content["application/json"].schema;

    expect(responseSchema.$defs).toBeUndefined();
    expect(specs.components?.schemas?.User).toBeDefined();
  });
});

/** Recursively collect every `#/components/schemas/*` $ref used in an object. */
function collectRefs(node: unknown, acc: Set<string> = new Set()): Set<string> {
  if (node == null || typeof node !== "object") return acc;

  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, acc);
    return acc;
  }

  for (const [key, value] of Object.entries(node)) {
    if (
      key === "$ref" &&
      typeof value === "string" &&
      value.startsWith("#/components/schemas/")
    ) {
      acc.add(value);
    } else {
      collectRefs(value, acc);
    }
  }

  return acc;
}
