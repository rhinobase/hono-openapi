import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

const Paging = z
  .object({ page: z.string(), size: z.string().optional() })
  .meta({ ref: "Paging" });

const listNotes = () =>
  new Hono().get(
    "/notes",
    describeRoute({ description: "List notes" }),
    validator("query", Paging),
    (c) => c.json([]),
  );

const pagingResponse = {
  description: "The paging",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Paging" },
    },
  },
};

describe("named query schemas inlined as parameters", () => {
  it("inlines the fields without publishing the schema", async () => {
    const specs = await generateSpecs(listNotes());

    expect(
      specs.paths["/notes"]?.get?.parameters?.map(
        (parameter) => "name" in parameter && parameter.name,
      ),
    ).toEqual(["page", "size"]);
    expect(specs.components?.schemas?.Paging).toBeUndefined();
  });

  it("keeps the schema when another route's response refers to it", async () => {
    const app = listNotes().get(
      "/paging",
      describeRoute({
        responses: {
          200: {
            description: "The default paging",
            content: { "application/json": { schema: resolver(Paging) } },
          },
        },
      }),
      (c) => c.json({ page: "1" }),
    );

    const specs = await generateSpecs(app);

    expect(
      specs.paths["/paging"]?.get?.responses?.[200]?.content?.[
        "application/json"
      ]?.schema,
    ).toEqual({ $ref: "#/components/schemas/Paging" });
    expect(specs.components?.schemas?.Paging).toBeDefined();
  });

  it("keeps the schema when the same route's response refers to it by hand", async () => {
    const app = new Hono().get(
      "/notes",
      describeRoute({ responses: { 200: pagingResponse } }),
      validator("query", Paging),
      (c) => c.json({ page: "1" }),
    );

    const specs = await generateSpecs(app);

    expect(specs.components?.schemas?.Paging).toMatchObject({
      properties: { page: { type: "string" }, size: { type: "string" } },
    });
  });

  it("keeps the schema when another route's response refers to it by hand", async () => {
    const app = listNotes().get(
      "/paging",
      describeRoute({ responses: { 200: pagingResponse } }),
      (c) => c.json({ page: "1" }),
    );

    const specs = await generateSpecs(app);

    expect(specs.components?.schemas?.Paging).toBeDefined();
  });

  it("drops the schema when only a hidden route refers to it", async () => {
    const app = listNotes().get(
      "/paging",
      describeRoute({ hide: true, responses: { 200: pagingResponse } }),
      (c) => c.json({ page: "1" }),
    );

    const specs = await generateSpecs(app);

    expect(specs.paths["/paging"]).toBeUndefined();
    expect(specs.components?.schemas?.Paging).toBeUndefined();
  });

  it("keeps the schema when documentation refers to it", async () => {
    const specs = await generateSpecs(listNotes(), {
      documentation: {
        paths: {
          "/legacy-notes": {
            get: {
              responses: {
                200: {
                  description: "OK",
                  content: {
                    "application/json": {
                      schema: { $ref: "#/components/schemas/Paging" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    expect(specs.components?.schemas?.Paging).toBeDefined();
  });

  it("still turns a single-field schema into a parameter component", async () => {
    const app = new Hono().get(
      "/notes",
      describeRoute({ description: "List notes" }),
      validator("query", z.object({ page: z.string() }).meta({ ref: "Page" })),
      (c) => c.json([]),
    );

    const specs = await generateSpecs(app);

    expect(specs.paths["/notes"]?.get?.parameters).toEqual([
      { $ref: "#/components/parameters/Page" },
    ]);
    expect(specs.components?.parameters?.Page).toBeDefined();
    expect(specs.components?.schemas?.Page).toBeUndefined();
  });
});
