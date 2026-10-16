import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { validator } from "../middlewares.js";

const parametersOf = async (schema: z.ZodType) => {
  const app = new Hono().get("/pets", validator("query", schema), (c) =>
    c.json(c.req.valid("query")),
  );
  const specs = await generateSpecs(app);
  return specs.paths["/pets"]?.get?.parameters;
};

describe("query validated by a union", () => {
  it("documents the fields of every variant", async () => {
    const parameters = await parametersOf(
      z.union([
        z.object({ limit: z.string().optional(), name: z.string() }),
        z.object({ limit: z.string().optional(), owner: z.string() }),
      ]),
    );

    expect(parameters).toEqual([
      { in: "query", name: "limit", schema: { type: "string" } },
      { in: "query", name: "name", schema: { type: "string" } },
      { in: "query", name: "owner", schema: { type: "string" } },
    ]);
  });

  it("requires a field only when every variant requires it", async () => {
    const parameters = await parametersOf(
      z.union([
        z.object({ q: z.string(), name: z.string() }),
        z.object({ q: z.string(), owner: z.string() }),
      ]),
    );

    expect(parameters).toEqual([
      { in: "query", name: "q", required: true, schema: { type: "string" } },
      { in: "query", name: "name", schema: { type: "string" } },
      { in: "query", name: "owner", schema: { type: "string" } },
    ]);
  });

  it("accepts any variant's schema for a field the variants type differently", async () => {
    const parameters = await parametersOf(
      z.discriminatedUnion("by", [
        z.object({ by: z.literal("name"), name: z.string() }),
        z.object({ by: z.literal("owner"), owner: z.string() }),
      ]),
    );

    expect(parameters).toEqual([
      {
        in: "query",
        name: "by",
        required: true,
        schema: {
          anyOf: [
            { const: "name", type: "string" },
            { const: "owner", type: "string" },
          ],
        },
      },
      { in: "query", name: "name", schema: { type: "string" } },
      { in: "query", name: "owner", schema: { type: "string" } },
    ]);
  });

  it("documents a union inside an intersection", async () => {
    const parameters = await parametersOf(
      z.intersection(
        z.object({ page: z.string() }),
        z.union([
          z.object({ name: z.string() }),
          z.object({ owner: z.string() }),
        ]),
      ),
    );

    expect(parameters).toEqual([
      { in: "query", name: "page", required: true, schema: { type: "string" } },
      { in: "query", name: "name", schema: { type: "string" } },
      { in: "query", name: "owner", schema: { type: "string" } },
    ]);
  });
});
