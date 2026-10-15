import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { validator } from "../middlewares.js";

const requestBodyOf = async (app: Hono, path: string) => {
  const specs = await generateSpecs(app);
  return specs.paths[path]?.post?.requestBody as
    | { required?: boolean }
    | undefined;
};

describe("requestBody.required", () => {
  it("is set when the route rejects a request without a body", async () => {
    const app = new Hono().post(
      "/",
      validator("json", z.object({ name: z.string() })),
      (c) => c.json({}),
    );

    expect((await app.request("/", { method: "POST" })).status).toBe(400);
    expect((await requestBodyOf(app, "/"))?.required).toBe(true);
  });

  it("is left out when the route accepts a request without a body", async () => {
    const app = new Hono().post(
      "/",
      validator("json", z.object({ name: z.string().optional() })),
      (c) => c.json({}),
    );

    expect((await app.request("/", { method: "POST" })).status).toBe(200);
    expect((await requestBodyOf(app, "/"))?.required).toBeUndefined();
  });

  it("is set when a refinement rejects a request without a body", async () => {
    const app = new Hono().post(
      "/",
      validator(
        "json",
        z
          .object({ email: z.string().optional(), name: z.string().optional() })
          .refine(
            (value) => value.email !== undefined || value.name !== undefined,
          ),
      ),
      (c) => c.json({}),
    );

    expect((await app.request("/", { method: "POST" })).status).toBe(400);
    expect((await requestBodyOf(app, "/"))?.required).toBe(true);
  });

  it("is set for a form the route can't do without", async () => {
    const app = new Hono().post(
      "/",
      validator("form", z.object({ name: z.string() })),
      (c) => c.json({}),
    );

    expect((await requestBodyOf(app, "/"))?.required).toBe(true);
  });
});
