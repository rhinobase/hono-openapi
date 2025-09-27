import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import z from "zod";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

describe("basic", () => {
  it("operationId", async () => {
    const operationId = vi.fn(() => "hello");

    const app = new Hono().get(
      "/",
      validator("json", z.object({ message: z.string() })),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    await generateSpecs(app, {
      defaultOptions: {
        GET: {
          operationId,
        },
      },
    });

    expect(operationId).toBeCalled();
    expect(operationId).toBeCalledTimes(1);
  });

  it("hide with a boolean value", async () => {
    const app = new Hono().get(
      "/",
      describeRoute({
        hide: true,
        description: "This is a test route",
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    message: z.string(),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });

  it("hide with a function", async () => {
    const app = new Hono().get(
      "/",
      describeRoute({
        hide: () => true,
        description: "This is a test route",
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    message: z.string(),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });
});
