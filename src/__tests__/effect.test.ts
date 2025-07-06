import { Schema } from "effect";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";
import { defineCommonTestRouteSpec } from "./utils/route.js";

describe("effect", () => {
  it("basic", async () => {
    const app = new Hono().get(
      "/:id",
      describeRoute(
        defineCommonTestRouteSpec(
          resolver(
            Schema.standardSchemaV1(
              Schema.Struct({
                message: Schema.String,
              }),
            ),
          ),
        ),
      ),
      validator(
        "param",
        Schema.standardSchemaV1(Schema.Struct({ id: Schema.String })),
      ),
      validator(
        "query",
        Schema.standardSchemaV1(
          Schema.Struct({
            category: Schema.Union(
              Schema.Literal("one"),
              Schema.Literal("two"),
              Schema.Literal("three"),
            ).pipe(Schema.optional),
          }),
        ),
      ),
      validator(
        "json",
        Schema.standardSchemaV1(
          Schema.Struct({
            message: Schema.String,
          }),
        ),
      ),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });
});
