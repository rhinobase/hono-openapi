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
