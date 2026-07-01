import { Hono } from "hono";
import type { InferRequestType } from "hono/client";
import { hc } from "hono/client";
import { describe, expectTypeOf, it } from "vitest";
import z from "zod/v4";
import { validator } from "../middlewares.js";

// Regression test for https://github.com/rhinobase/hono-openapi/pull/234
//
// `validator()` used to flatten query fields through
// `ValidationTargets[K][K2]`. When an object mixed a literal-union field with
// another field (e.g. a coerced number), the union collapsed to
// `string | string[]`, breaking Hono RPC client autocomplete. It now mirrors
// `@hono/standard-validator`'s `InferInput`, preserving literal unions while
// falling back to wire types for coerced values.

describe("validator RPC input types", () => {
  it("preserves literal unions alongside coerced fields for query targets", () => {
    const app = new Hono().get(
      "/",
      validator(
        "query",
        z.object({
          sortBy: z.enum(["name", "type", "isActive", "createdAt"]),
          // A non-literal field is required to trigger the old flattening bug.
          page: z.coerce.number(),
        }),
      ),
      (c) => c.json(c.req.valid("query")),
    );

    const client = hc<typeof app>("http://localhost");
    type Query = InferRequestType<typeof client.index.$get>["query"];

    // Literal union preserved for autocomplete.
    expectTypeOf<Query["sortBy"]>().toEqualTypeOf<
      "name" | "type" | "isActive" | "createdAt"
    >();

    // Coerced numbers arrive over the wire as strings.
    expectTypeOf<Query["page"]>().toEqualTypeOf<string | string[]>();
  });

  it("keeps object shape for json targets", () => {
    const app = new Hono().post(
      "/",
      validator(
        "json",
        z.object({
          name: z.string(),
          age: z.number(),
        }),
      ),
      (c) => c.json(c.req.valid("json")),
    );

    const client = hc<typeof app>("http://localhost");
    type Json = InferRequestType<typeof client.index.$post>["json"];

    expectTypeOf<Json>().toEqualTypeOf<{ name: string; age: number }>();
  });
});
