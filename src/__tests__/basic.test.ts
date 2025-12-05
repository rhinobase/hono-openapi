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
