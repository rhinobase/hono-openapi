import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

type Parameter = {
  $ref?: string;
  in?: string;
  name?: string;
  required?: boolean;
};

const operations = async (app: Hono) => {
  const specs = await generateSpecs(app);
  const resolve = (parameter: Parameter): Parameter =>
    parameter.$ref
      ? ((specs.components?.parameters?.[
          parameter.$ref.replace("#/components/parameters/", "")
        ] as Parameter | undefined) ?? parameter)
      : parameter;

  return Object.fromEntries(
    Object.entries(specs.paths).map(([path, item]) => [
      path,
      {
        operationId: item?.get?.operationId,
        pathParameters: ((item?.get?.parameters ?? []) as Parameter[])
          .map(resolve)
          .filter((parameter) => parameter.in === "path")
          .map(({ name, required }) => ({ name, required })),
      },
    ]),
  );
};

describe("optional path parameters", () => {
  it("documents the path with and without the parameter", async () => {
    const app = new Hono().get(
      "/notes/:id?",
      describeRoute({ description: "List notes, or get one by its ID" }),
      (c) => c.json({ id: c.req.param("id") ?? null }),
    );

    expect((await app.request("/notes")).status).toBe(200);
    expect((await app.request("/notes/1")).status).toBe(200);
    expect(await operations(app)).toEqual({
      "/notes": { operationId: "getNotes", pathParameters: [] },
      "/notes/{id}": {
        operationId: "getNotesById",
        pathParameters: [{ name: "id", required: true }],
      },
    });
  });

  it("documents every path when several trailing parameters are optional", async () => {
    const app = new Hono().get(
      "/archive/:year?/:month?",
      describeRoute({ description: "Browse the archive" }),
      (c) => c.json(c.req.param()),
    );

    const statuses = await Promise.all(
      ["/archive", "/archive/2026", "/archive/2026/10"].map(
        async (path) => (await app.request(path)).status,
      ),
    );
    expect(statuses).toEqual([200, 200, 200]);
    expect(Object.keys(await operations(app))).toEqual([
      "/archive",
      "/archive/{year}",
      "/archive/{year}/{month}",
    ]);
  });

  it("keeps a param validator's parameter on the path that has it", async () => {
    const app = new Hono().get(
      "/notes/:id?",
      describeRoute({ description: "List notes, or get one by its ID" }),
      validator("param", z.object({ id: z.string().optional() })),
      (c) => c.json(c.req.valid("param")),
    );

    expect(await operations(app)).toEqual({
      "/notes": { operationId: "getNotes", pathParameters: [] },
      "/notes/{id}": {
        operationId: "getNotesById",
        pathParameters: [{ name: "id", required: true }],
      },
    });
  });

  it("keeps a written operationId unique", async () => {
    const app = new Hono().get(
      "/notes/:id?",
      describeRoute({ operationId: "findNotes" }),
      (c) => c.json({}),
    );

    expect(await operations(app)).toEqual({
      "/notes": { operationId: "findNotesWithoutId", pathParameters: [] },
      "/notes/{id}": {
        operationId: "findNotes",
        pathParameters: [{ name: "id", required: true }],
      },
    });
  });

  it("keeps a named path parameter only on the path that has it", async () => {
    const app = new Hono().get(
      "/notes/:id?",
      describeRoute({ description: "List notes, or get one by its ID" }),
      validator(
        "param",
        z.object({ id: z.string().optional() }).meta({ ref: "NoteId" }),
      ),
      (c) => c.json(c.req.valid("param")),
    );

    expect(await operations(app)).toEqual({
      "/notes": { operationId: "getNotes", pathParameters: [] },
      "/notes/{id}": {
        operationId: "getNotesById",
        pathParameters: [{ name: "id", required: true }],
      },
    });
  });

  it("keeps the components the path without the parameter refers to", async () => {
    const Note = z.object({ title: z.string() }).meta({ ref: "Note" });
    const app = new Hono().get(
      "/notes/:id?",
      describeRoute({
        operationId: "findNotes",
        responses: {
          200: {
            description: "The notes",
            content: { "application/json": { schema: resolver(Note) } },
          },
        },
      }),
      (c) => c.json({ title: "Groceries" }),
    );

    const specs = await generateSpecs(app, { exclude: ["/notes/{id}"] });

    expect(Object.keys(specs.paths)).toEqual(["/notes"]);
    expect(
      (
        specs.paths["/notes"]?.get?.responses?.[200] as {
          content: Record<string, { schema: unknown }>;
        }
      ).content["application/json"].schema,
    ).toEqual({ $ref: "#/components/schemas/Note" });
    expect(specs.components?.schemas?.Note).toBeDefined();
  });

  it("keeps a documented path parameter only on the path that has it", async () => {
    const NoteId = {
      in: "path",
      name: "id",
      required: true,
      schema: { type: "string" },
    } as const;
    const app = new Hono().get(
      "/notes/:id?",
      describeRoute({
        parameters: [{ $ref: "#/components/parameters/NoteId" }],
      }),
      (c) => c.json({ id: c.req.param("id") ?? null }),
    );

    const specs = await generateSpecs(app, {
      documentation: { components: { parameters: { NoteId } } },
    });

    expect(specs.paths["/notes"]?.get?.parameters ?? []).toEqual([]);
    expect(specs.paths["/notes/{id}"]?.get?.parameters).toEqual([
      { $ref: "#/components/parameters/NoteId" },
    ]);
    expect(specs.components?.parameters?.NoteId).toEqual(NoteId);
  });
});
