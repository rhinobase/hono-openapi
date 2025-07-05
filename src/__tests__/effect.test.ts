import { Schema } from "effect";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

describe("effect", () => {
  it("basic", async () => {
    const app = new Hono().get(
      "/",
      describeRoute({
        tags: ["test"],
        summary: "Test route",
        description: "This is a test route",
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: resolver(
                  Schema.standardSchemaV1(Schema.Struct({
                    message: Schema.String,
                  })),
                ),
              },
            },
          },
        },
      }),
      validator(
        "json",
        Schema.standardSchemaV1(Schema.Struct({
          message: Schema.String,
        })),
      ),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });
});
