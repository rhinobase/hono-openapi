import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { validator } from "../middlewares.js";

const parametersOf = async (app: Hono, path: string) => {
  const specs = await generateSpecs(app);
  return JSON.parse(JSON.stringify(specs.paths[path]?.get?.parameters)) as {
    deprecated?: boolean;
    name: string;
    schema: Record<string, unknown>;
  }[];
};

describe("parameter deprecated", () => {
  it("marks the parameter of a deprecated query field", async () => {
    const app = new Hono().get(
      "/pets",
      validator(
        "query",
        z.object({
          order: z.enum(["asc", "desc"]).optional(),
          sort: z
            .string()
            .optional()
            .meta({ deprecated: true, description: "Use `order` instead" }),
        }),
      ),
      (c) => c.json([]),
    );

    const [order, sort] = await parametersOf(app, "/pets");

    expect(sort).toEqual({
      deprecated: true,
      description: "Use `order` instead",
      in: "query",
      name: "sort",
      schema: { type: "string" },
    });
    expect(order?.deprecated).toBeUndefined();
  });

  it("marks the parameter of a deprecated header field", async () => {
    const app = new Hono().get(
      "/pets",
      validator(
        "header",
        z.object({ "x-legacy-key": z.string().meta({ deprecated: true }) }),
      ),
      (c) => c.json([]),
    );

    const [header] = await parametersOf(app, "/pets");

    expect(header).toEqual({
      deprecated: true,
      in: "header",
      name: "x-legacy-key",
      required: true,
      schema: { type: "string" },
    });
  });
});
