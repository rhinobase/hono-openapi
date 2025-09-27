import { Hono } from "hono";
import Type from "typebox";
import { Compile } from "typebox/compile";
import { describe, expect, it } from "vitest";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

describe("typebox", () => {
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
                  Compile(
                    Type.Object({
                      message: Type.String(),
                    }),
                  ),
                ),
              },
            },
          },
        },
      }),
      validator("json", Compile(Type.Object({ message: Type.String() }))),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });

  it("with metadata", async () => {
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
                  Compile(
                    Type.Object(
                      {
                        message: Type.String(),
                      },
                      {
                        $id: "SuccessResponse",
                      },
                    ),
                  ),
                ),
              },
            },
          },
        },
      }),
      validator("json", Compile(Type.Object({ message: Type.String() }))),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });
});
