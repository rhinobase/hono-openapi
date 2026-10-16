import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, validator } from "../middlewares.js";

const operations = async (app: Hono) => {
  const specs = await generateSpecs(app);
  return Object.fromEntries(
    Object.entries(specs.paths).map(([path, item]) => [
      path,
      {
        operationId: item?.get?.operationId,
        pathParameters: (
          (item?.get?.parameters ?? []) as { in: string; name: string }[]
        )
          .filter((parameter) => parameter.in === "path")
          .map(({ name, ...parameter }) => ({
            name,
            required: (parameter as { required?: boolean }).required,
          })),
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
});
