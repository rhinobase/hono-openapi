import { type Context, Hono } from "hono";
import { describe, expect, it } from "vitest";
import { openAPIRouteHandler } from "../handler.js";
import { describeRoute } from "../middlewares.js";
import type { GenerateSpecOptions } from "../types.js";

const hiddenFromOthers = ({ c }: { c?: Context }) =>
  c?.req.header("x-role") !== "admin";

const documentedPaths = async (app: Hono, headers?: Record<string, string>) => {
  const response = await app.request("/openapi.json", { headers });
  const { paths } = (await response.json()) as { paths: object };
  return Object.keys(paths);
};

describe("openAPIRouteHandler", () => {
  const notes = (
    hide?: Parameters<typeof describeRoute>[0]["hide"],
    options?: Partial<GenerateSpecOptions>,
  ) => {
    const app = new Hono();
    app.get(
      "/notes/archived",
      describeRoute({
        ...(hide !== undefined && { hide }),
        responses: { 200: { description: "OK" } },
      }),
      (c) => c.json([]),
    );
    app.get("/openapi.json", openAPIRouteHandler(app, options));
    return app;
  };

  it("decides a `hide` function for each request", async () => {
    const app = notes(hiddenFromOthers);

    expect(await documentedPaths(app, { "x-role": "admin" })).toEqual([
      "/notes/archived",
    ]);
    expect(await documentedPaths(app)).toEqual([]);
    expect(await documentedPaths(app, { "x-role": "admin" })).toEqual([
      "/notes/archived",
    ]);
  });

  it("decides a `hide` function from `defaultOptions` for each request", async () => {
    const app = notes(undefined, {
      defaultOptions: { GET: { hide: hiddenFromOthers } },
    });

    expect(await documentedPaths(app)).toEqual([]);
    expect(await documentedPaths(app, { "x-role": "admin" })).toEqual([
      "/notes/archived",
    ]);
  });

  it("keeps hiding a route that's always hidden", async () => {
    const app = notes(true);

    expect(await documentedPaths(app, { "x-role": "admin" })).toEqual([]);
    expect(await documentedPaths(app)).toEqual([]);
  });
});
