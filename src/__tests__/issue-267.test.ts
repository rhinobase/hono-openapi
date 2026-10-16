import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { generateSpecs } from "../handler.js";
import { describeRoute } from "../middlewares.js";

const documented = describeRoute({ responses: { 200: { description: "OK" } } });

const operationIds = async (app: Hono) => {
  const specs = await generateSpecs(app);
  return Object.fromEntries(
    Object.entries(specs.paths).map(([path, item]) => [
      path,
      item?.get?.operationId,
    ]),
  );
};

describe("generated operation IDs", () => {
  it("are unique when a path parameter and a literal segment generate the same ID", async () => {
    const app = new Hono()
      .get("/notes/:id", documented, (c) => c.json({}))
      .get("/notes/by-id", documented, (c) => c.json({}));

    expect(await operationIds(app)).toEqual({
      "/notes/{id}": "getNotesById",
      "/notes/by-id": "getNotesById2",
    });
  });

  it("are unique when paths differ only in punctuation", async () => {
    const app = new Hono()
      .get("/note-list", documented, (c) => c.json([]))
      .get("/noteList", documented, (c) => c.json([]));

    expect(await operationIds(app)).toEqual({
      "/note-list": "getNoteList",
      "/noteList": "getNoteList2",
    });
  });

  it("don't take an ID another route generates", async () => {
    const app = new Hono()
      .get("/notes", documented, (c) => c.json([]))
      .get("/notes/", documented, (c) => c.json([]))
      .get("/notes2", documented, (c) => c.json([]));

    expect(await operationIds(app)).toEqual({
      "/notes": "getNotes",
      "/notes/": "getNotes3",
      "/notes2": "getNotes2",
    });
  });

  it("don't take an ID set explicitly, which is kept", async () => {
    const app = new Hono()
      .get("/notes/:id", documented, (c) => c.json({}))
      .get(
        "/notes/by-id",
        describeRoute({ operationId: "getNotesById" }),
        (c) => c.json({}),
      );

    expect(await operationIds(app)).toEqual({
      "/notes/{id}": "getNotesById2",
      "/notes/by-id": "getNotesById",
    });
  });

  it("don't take an ID set in `documentation.paths`", async () => {
    const app = new Hono().get("/notes/by-id", documented, (c) => c.json({}));

    const specs = await generateSpecs(app, {
      documentation: {
        paths: {
          "/notes/{id}": {
            get: {
              operationId: "getNotesById",
              responses: { 200: { description: "OK" } },
            },
          },
        },
      },
    });

    expect(specs.paths["/notes/by-id"]?.get?.operationId).toBe("getNotesById2");
    expect(specs.paths["/notes/{id}"]?.get?.operationId).toBe("getNotesById");
  });

  it("aren't changed by a hidden route", async () => {
    const app = new Hono()
      .get("/notes/:id", describeRoute({ hide: true }), (c) => c.json({}))
      .get("/notes/by-id", documented, (c) => c.json({}));

    expect(await operationIds(app)).toEqual({
      "/notes/by-id": "getNotesById",
    });
  });

  it("aren't taken from middleware described more than once on a path", async () => {
    const app = new Hono()
      .use("/notes/*", describeRoute({ tags: ["notes"] }))
      .use("/notes/*", describeRoute({ tags: ["public"] }))
      .get("/notes/:id", documented, (c) => c.json({}))
      .get("/notes/list", documented, (c) => c.json([]));

    expect(await operationIds(app)).toEqual({
      "/notes/{id}": "getNotesById",
      "/notes/list": "getNotesList",
    });
  });

  it("are the same on every generation", async () => {
    const app = new Hono()
      .get("/notes/:id", documented, (c) => c.json({}))
      .get("/notes/by-id", documented, (c) => c.json({}));

    const [first, ...others] = await Promise.all([
      operationIds(app),
      operationIds(app),
      operationIds(app),
    ]);

    expect(others).toEqual([first, first]);
    expect(await operationIds(app)).toEqual(first);
  });
});
