import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import z from "zod/v4";

describe("issue-216", () => {
  it("documents routes described by another copy of hono-openapi", async () => {
    const { describeRoute, validator } = await import("../middlewares.js");
    vi.resetModules();
    const { generateSpecs } = await import("../handler.js");

    const app = new Hono().post(
      "/users",
      describeRoute({
        operationId: "createUser",
        responses: { 200: { description: "OK" } },
      }),
      validator("json", z.object({ name: z.string() })),
      (c) => c.json({}),
    );

    const specs = await generateSpecs(app);

    expect(specs.paths["/users"]?.post?.operationId).toBe("createUser");
    expect(specs.paths["/users"]?.post?.requestBody).toBeDefined();
  });
});
