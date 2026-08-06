import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import z from "zod";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";
import "zod-openapi/extend";

describe("path parameters", () => {
  it("should not leak path parameters from one route to another", async () => {
    // Route WITHOUT path parameters, registered FIRST
    // Route WITH path parameters, registered SECOND
    // The path parameters from the second route should NOT leak to the first
    const app = new Hono()
      .get(
        "/foo",
        describeRoute({
          description: "Route without path params",
          responses: { 200: { description: "OK" } },
        }),
        async (c) => c.json({ ok: true }),
      )
      .get(
        "/bar/:name",
        describeRoute({
          description: "Route with path params",
          responses: { 200: { description: "OK" } },
        }),
        async (c) => c.json({ name: c.req.param("name") }),
      );

    const specs = await generateSpecs(app);

    // /foo should NOT have any path parameters
    const fooParams = specs.paths["/foo"]?.get?.parameters ?? [];
    const fooPathParams = fooParams.filter(
      (p: { in?: string }) => p.in === "path",
    );
    expect(fooPathParams).toEqual([]);

    // /bar/{name} SHOULD have the name path parameter
    const barParams = specs.paths["/bar/{name}"]?.get?.parameters ?? [];
    const barPathParams = barParams.filter(
      (p: { in?: string }) => p.in === "path",
    );
    expect(barPathParams).toHaveLength(1);
    expect(barPathParams[0]).toMatchObject({ in: "path", name: "name" });
  });

  it("should not leak path parameters when using .use() middleware with validator", async () => {
    // This reproduces a bug where path parameters from routes with :name
    // leak to ALL routes when a .use() middleware with validator is present.
    // See: https://github.com/rhinobase/hono-openapi/issues/XXX
    const app = new Hono()
      .use(validator("query", z.object({ q: z.string().optional() })))
      .get(
        "/foo",
        describeRoute({
          description: "Route without path params",
          responses: { 200: { description: "OK" } },
        }),
        async (c) => c.json({ ok: true }),
      )
      .get(
        "/bar/:name",
        describeRoute({
          description: "Route with path params",
          responses: { 200: { description: "OK" } },
        }),
        async (c) => c.json({ name: c.req.param("name") }),
      );

    const specs = await generateSpecs(app);

    // /foo should only have the query parameter, NOT any path parameters
    const fooParams = specs.paths["/foo"]?.get?.parameters ?? [];
    const fooPathParams = fooParams.filter(
      (p: { in?: string }) => p.in === "path",
    );
    expect(fooPathParams).toEqual([]);

    // /bar/{name} SHOULD have the name path parameter
    const barParams = specs.paths["/bar/{name}"]?.get?.parameters ?? [];
    const barPathParams = barParams.filter(
      (p: { in?: string }) => p.in === "path",
    );
    expect(barPathParams).toHaveLength(1);
    expect(barPathParams[0]).toMatchObject({ in: "path", name: "name" });
  });
});

describe("path context matching", () => {
  it("should not apply describeRoute context from one router to unrelated routes with same trailing path", async () => {
    // Reproduces https://github.com/rhinobase/hono-openapi/issues/143
    // /players middleware should NOT apply to /collections/players
    const app = new Hono();

    app.route(
      "/players",
      new Hono().use(
        describeRoute({
          tags: ["Players"],
        }),
      ),
    );

    app.route(
      "/collections",
      new Hono()
        .use(
          describeRoute({
            tags: ["Player Collections"],
          }),
        )
        .get(
          "/players",
          describeRoute({
            summary: "Hello",
          }),
          async (c) => {
            return c.body("hello world");
          },
        ),
    );

    const specs = await generateSpecs(app);

    const collectionPlayers = specs.paths["/collections/players"]?.get;
    expect(collectionPlayers).toBeDefined();
    // Should only have "Player Collections" tag, NOT "Players"
    expect(collectionPlayers?.tags).toEqual(["Player Collections"]);
    expect(collectionPlayers?.tags).not.toContain("Players");
  });

  it("should correctly scope context to prefix-matched paths only", async () => {
    // Module-level middleware with describeRoute on /module should not
    // apply to /module2 even though /module2 starts with /module
    const app = new Hono();

    app.route(
      "/module",
      new Hono().use(
        describeRoute({
          tags: ["Module"],
        }),
      ),
    );

    app.route(
      "/module2",
      new Hono().get(
        "/endpoint",
        describeRoute({
          summary: "Module2 endpoint",
        }),
        async (c) => {
          return c.body("hello");
        },
      ),
    );

    const specs = await generateSpecs(app);

    const module2Endpoint = specs.paths["/module2/endpoint"]?.get;
    expect(module2Endpoint).toBeDefined();
    // /module2/endpoint should NOT get the "Module" tag from /module middleware
    expect(module2Endpoint?.tags).toBeUndefined();
  });

  it("should not leak context across sibling routers mounted with use('/') and a basePath", async () => {
    // Reproduces the exact MRE from
    // https://github.com/rhinobase/hono-openapi/issues/143
    // where the context key has no trailing wildcard (from `use("/")`).
    const module = new Hono();
    module.use("/", describeRoute({ tags: ["Module"] }));
    module.get("/1", describeRoute({ summary: "1" }), (c) => c.json({}));

    const module2 = new Hono();
    module2.use("/", describeRoute({ tags: ["Module2"] }));
    module2.get("/2", describeRoute({ summary: "2" }), (c) => c.json({}));

    const api = new Hono().basePath("/api");
    api.route("/module", module);
    api.route("/module2", module2);

    const specs = await generateSpecs(api);

    // /api/module/1 should only carry the "Module" tag
    const moduleOne = specs.paths["/api/module/1"]?.get;
    expect(moduleOne?.tags).toEqual(["Module"]);
    expect(moduleOne?.tags).not.toContain("Module2");

    // /api/module2/2 should only carry the "Module2" tag
    const moduleTwo = specs.paths["/api/module2/2"]?.get;
    expect(moduleTwo?.tags).toEqual(["Module2"]);
    expect(moduleTwo?.tags).not.toContain("Module");
  });

  it("should apply root-level use() context to every route", async () => {
    // A context registered at the app root (key "/*", i.e. empty prefix)
    // must apply to all paths.
    const app = new Hono()
      .use(describeRoute({ tags: ["Global"] }))
      .get("/foo", describeRoute({ summary: "foo" }), (c) => c.body("x"))
      .get("/bar/baz", describeRoute({ summary: "bar" }), (c) => c.body("x"));

    const specs = await generateSpecs(app);

    expect(specs.paths["/foo"]?.get?.tags).toEqual(["Global"]);
    expect(specs.paths["/bar/baz"]?.get?.tags).toEqual(["Global"]);
  });

  it("should apply context to nested sub-paths of the mounted prefix", async () => {
    // Positive case: context on /players must still reach /players and
    // deeper paths like /players/{id}.
    const app = new Hono();

    app.route(
      "/players",
      new Hono()
        .use(describeRoute({ tags: ["Players"] }))
        .get("/", describeRoute({ summary: "list" }), (c) => c.body("x"))
        .get("/:id", describeRoute({ summary: "detail" }), (c) => c.body("x")),
    );

    const specs = await generateSpecs(app);

    expect(specs.paths["/players"]?.get?.tags).toEqual(["Players"]);
    expect(specs.paths["/players/{id}"]?.get?.tags).toEqual(["Players"]);
  });
});

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

  it("composed handler", async () => {
    const subApp = new Hono();
    subApp.onError((err, c) => c.json({ message: err.message }, 500));
    subApp.get(
      "/",
      describeRoute({
        description: "This is sub app route",
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
          500: {
            description: "Error",
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

    const app = new Hono();
    app.route("/", subApp);

    const specs = await generateSpecs(app);
    expect(specs).toMatchSnapshot();
  });
});
