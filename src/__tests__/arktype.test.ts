import { type } from "arktype";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

// add this anywhere in your project
declare global {
  interface ArkEnv {
    meta(): {
      // meta properties should always be optional
      ref?: string;
    };
  }
}

describe("arktype", () => {
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
                  type({
                    message: "string",
                  }),
                ),
              },
            },
          },
        },
      }),
      validator("json", type({ message: "string" })),
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
                  type({
                    message: "string",
                  }).configure({
                    ref: "SuccessResponse",
                  }),
                ),
              },
            },
          },
        },
      }),
      validator("json", type({ message: "string" })),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });
});
