import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import z from "zod";
import { generateSpecs } from "../handler.js";
import { validator } from "../middlewares.js";
import "zod-openapi/extend";

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

    const specs = await generateSpecs(app, {
      defaultOptions: {
        GET: {
          operationId
        }
      }
    });

    expect(operationId).toBeCalled();
    expect(operationId).toBeCalledTimes(1)
  });
});
