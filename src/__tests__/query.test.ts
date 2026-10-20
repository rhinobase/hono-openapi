import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, validator } from "../middlewares.js";
import type { GenerateSpecOptions } from "../types.js";

const ok = { responses: { 200: { description: "OK" } } };
const search = (hide = false) =>
  new Hono()
    .get("/health", describeRoute(ok), (c) => c.json({ ok: true }))
    .on(
      "QUERY",
      "/search",
      describeRoute({ ...ok, hide, tags: ["search"] }),
      validator("json", z.object({ term: z.string() })),
      (c) => c.json(c.req.valid("json")),
    );

const callback = {
  "{$request.body#/callbackUrl}": { query: ok },
};

describe("QUERY operations and the document version", () => {
  it("documents QUERY alongside existing methods, including its validated body", async () => {
    const app = search();
    const specs = await generateSpecs(app);
    const response = await app.request("/search", {
      method: "QUERY",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ term: "hono" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ term: "hono" });

    expect(specs.openapi).toBe("3.2.0");
    expect(specs.paths["/health"]?.get?.responses).toEqual(ok.responses);
    expect(specs.paths["/search"]?.query).toMatchObject({
      operationId: "querySearch",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { term: { type: "string" } },
              required: ["term"],
            },
          },
        },
      },
      responses: { 200: { description: "OK" } },
    });
  });

  it.each<Partial<GenerateSpecOptions>>([
    { exclude: "/search" },
    { excludeMethods: ["QUERY"] },
  ])("keeps 3.1 when QUERY is excluded with %j", async (options) => {
    const specs = await generateSpecs(search(), options);

    expect(specs.openapi).toBe("3.1.0");
    expect(specs.paths["/search"]).toBeUndefined();
    expect(specs.paths["/health"]?.get).toBeDefined();
  });

  it("keeps QUERY when only its tag declaration is excluded", async () => {
    const specs = await generateSpecs(search(), {
      excludeTags: ["search"],
      documentation: { tags: [{ name: "search" }] },
    });

    expect(specs.tags).toEqual([]);
    expect(specs.openapi).toBe("3.2.0");
    expect(specs.paths["/search"]?.query).toBeDefined();
  });

  it("does not count a hidden QUERY route", async () => {
    const specs = await generateSpecs(search(true));

    expect(specs.openapi).toBe("3.1.0");
    expect(specs.paths["/search"]).toBeUndefined();
  });

  it("counts hidden QUERY routes when they are included", async () => {
    const specs = await generateSpecs(search(true), {
      includeHiddenRoutes: true,
    });

    expect(specs.openapi).toBe("3.2.0");
    expect(specs.paths["/search"]?.query).toBeDefined();
  });

  it("counts an undocumented QUERY route when empty paths are included", async () => {
    const app = new Hono().on("QUERY", "/search", (c) => c.json({}));
    const specs = await generateSpecs(app, { includeEmptyPaths: true });

    expect(specs.openapi).toBe("3.2.0");
    expect(specs.paths["/search"]?.query).toBeDefined();
  });

  it("checks paths after documentation overrides are applied", async () => {
    const specs = await generateSpecs(search(), {
      documentation: { paths: { "/search": { get: ok } } },
    });

    expect(specs.openapi).toBe("3.1.0");
    expect(specs.paths["/search"]?.query).toBeUndefined();
    expect(specs.paths["/search"]?.get).toBeDefined();
  });

  it.each<Partial<GenerateSpecOptions>["documentation"]>([
    { paths: { "/manual": { query: ok } } },
    { webhooks: { incoming: { query: ok } } },
    {
      paths: {
        "/manual": { post: { ...ok, callbacks: { result: callback } } },
      },
    },
    { components: { pathItems: { Search: { query: ok } } } },
    { components: { callbacks: { Search: callback } } },
    {
      paths: {
        "/manual": {
          post: {
            ...ok,
            callbacks: {
              first: {
                "{$request.body#/callbackUrl}": {
                  post: { ...ok, callbacks: { nested: callback } },
                },
              },
            },
          },
        },
      },
    },
    {
      paths: { "/manual": { $ref: "#/components/pathItems/Search" } },
      components: { pathItems: { Search: { query: ok } } },
    },
  ])(
    "detects QUERY in documented Path Item locations: %j",
    async (documentation) => {
      const specs = await generateSpecs(new Hono(), { documentation });

      expect(specs.openapi).toBe("3.2.0");
    },
  );

  it("does not confuse payloads, property names, or extensions with operations", async () => {
    const pathItem = {
      get: {
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { example: { query: ok } } },
          },
        },
        callbacks: { result: { "x-example": { query: ok } } },
      },
      "x-example": { query: ok },
    };
    const specs = await generateSpecs(new Hono(), {
      documentation: {
        paths: { "/manual": pathItem },
        components: {
          schemas: {
            Search: {
              type: "object",
              properties: { query: { type: "string" } },
            },
          },
        },
      },
    });

    expect(specs.openapi).toBe("3.1.0");
  });

  it.each(["3.0.3", "3.1.2", "3.2.1"])(
    "honors explicit %s without QUERY",
    async (openapi) => {
      const specs = await generateSpecs(new Hono(), {
        documentation: { openapi },
      });

      expect(specs.openapi).toBe(openapi);
    },
  );

  it.each(["3.2.0", "3.2.1", "3.10.0"])(
    "honors compatible explicit %s with QUERY",
    async (openapi) => {
      const specs = await generateSpecs(search(), {
        documentation: { openapi },
      });

      expect(specs.openapi).toBe(openapi);
      expect(specs.paths["/search"]?.query).toBeDefined();
    },
  );

  it.each(["3.0.3", "3.1.0", "3.1.2"])(
    "rejects explicit %s with QUERY",
    async (openapi) => {
      await expect(
        generateSpecs(search(), { documentation: { openapi } }),
      ).rejects.toThrow(/QUERY.*3\.2/);
    },
  );

  it("allows an explicit older version when QUERY has been filtered out", async () => {
    const specs = await generateSpecs(search(true), {
      documentation: { openapi: "3.1.2" },
    });

    expect(specs.openapi).toBe("3.1.2");
  });
});
