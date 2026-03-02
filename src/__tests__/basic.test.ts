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

describe("default validation error response", () => {
  it("should include a 400 response when validator is used", async () => {
    const app = new Hono().post(
      "/",
      validator("json", z.object({ message: z.string() })),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    const postSpec = specs.paths["/"]?.post;
    expect(postSpec?.responses?.["400"]).toBeDefined();
    expect(postSpec?.responses?.["400"]).toMatchObject({
      description: "Validation Error",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", enum: [false] },
              error: { type: "array", items: {} },
              data: {},
            },
            required: ["success", "error"],
          },
        },
      },
    });
  });

  it("should not include 400 when defaultValidationErrorResponse is false", async () => {
    const app = new Hono().post(
      "/",
      validator("json", z.object({ message: z.string() })),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app, {
      defaultValidationErrorResponse: false,
    });

    const postSpec = specs.paths["/"]?.post;
    expect(postSpec?.responses?.["400"]).toBeUndefined();
  });

  it("should allow a custom 400 response via defaultValidationErrorResponse", async () => {
    const app = new Hono().post(
      "/",
      validator("json", z.object({ message: z.string() })),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const customResponse = {
      description: "Custom Validation Error",
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            properties: {
              message: { type: "string" as const },
            },
          },
        },
      },
    };

    const specs = await generateSpecs(app, {
      defaultValidationErrorResponse: customResponse,
    });

    const postSpec = specs.paths["/"]?.post;
    expect(postSpec?.responses?.["400"]).toEqual(customResponse);
  });

  it("should not override user-defined 400 response in describeRoute", async () => {
    const app = new Hono().post(
      "/",
      describeRoute({
        responses: {
          200: { description: "OK" },
          400: { description: "My custom 400" },
        },
      }),
      validator("json", z.object({ message: z.string() })),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    const postSpec = specs.paths["/"]?.post;
    // The user-defined 400 should take precedence
    expect(postSpec?.responses?.["400"]).toMatchObject({
      description: "My custom 400",
    });
  });

  it("should not include 400 for routes without validators", async () => {
    const app = new Hono().get(
      "/",
      describeRoute({
        responses: {
          200: { description: "OK" },
        },
      }),
      async (c) => {
        return c.json({ ok: true });
      },
    );

    const specs = await generateSpecs(app);

    const getSpec = specs.paths["/"]?.get;
    expect(getSpec?.responses?.["400"]).toBeUndefined();
  });

  it("should not include 400 for routes with only path params and no validator", async () => {
    const app = new Hono().get(
      "/users/:id",
      describeRoute({
        responses: {
          200: { description: "OK" },
        },
      }),
      async (c) => {
        return c.json({ id: c.req.param("id") });
      },
    );

    const specs = await generateSpecs(app);

    const getSpec = specs.paths["/users/{id}"]?.get;
    expect(getSpec).toBeDefined();
    // Auto-generated path params should NOT trigger 400
    expect(getSpec?.responses?.["400"]).toBeUndefined();
  });
});
