import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, validator } from "../middlewares.js";

const requestBodyOf = async (app: Hono, path = "/") => {
  const specs = await generateSpecs(app);
  return specs.paths[path]?.post?.requestBody as
    | { required?: boolean }
    | undefined;
};

describe("requestBody.required", () => {
  it("is set when the schema requires a field", async () => {
    const app = new Hono().post(
      "/",
      validator("json", z.object({ name: z.string() })),
      (c) => c.json({}),
    );

    expect((await app.request("/", { method: "POST" })).status).toBe(400);
    expect((await requestBodyOf(app))?.required).toBe(true);
  });

  it("is left out when every field is optional", async () => {
    const app = new Hono().post(
      "/",
      validator("json", z.object({ name: z.string().optional() })),
      (c) => c.json({}),
    );

    expect((await app.request("/", { method: "POST" })).status).toBe(200);
    expect((await requestBodyOf(app))?.required).toBeUndefined();
  });

  it("is set for a named schema that requires a field", async () => {
    const app = new Hono().post(
      "/",
      validator("json", z.object({ name: z.string() }).meta({ ref: "Pet" })),
      (c) => c.json({}),
    );

    expect((await requestBodyOf(app))?.required).toBe(true);
  });

  it("is left out for a named schema whose fields are all optional", async () => {
    const app = new Hono().post(
      "/",
      validator(
        "json",
        z.object({ name: z.string().optional() }).meta({ ref: "Draft" }),
      ),
      (c) => c.json({}),
    );

    expect((await requestBodyOf(app))?.required).toBeUndefined();
  });

  it("is set when the schema isn't a plain object", async () => {
    const app = new Hono().post(
      "/",
      validator(
        "json",
        z.union([
          z.object({ email: z.string().optional() }),
          z.object({ name: z.string().optional() }),
        ]),
      ),
      (c) => c.json({}),
    );

    expect((await requestBodyOf(app))?.required).toBe(true);
  });

  it("is set for a form the route can't do without", async () => {
    const app = new Hono().post(
      "/",
      validator("form", z.object({ name: z.string() })),
      (c) => c.json({}),
    );

    expect((await requestBodyOf(app))?.required).toBe(true);
  });

  it("doesn't run the validator's refinements while generating the document", async () => {
    let calls = 0;
    const app = new Hono().post(
      "/",
      validator(
        "json",
        z.object({ name: z.string().optional() }).superRefine(async () => {
          calls++;
        }),
      ),
      (c) => c.json({}),
    );

    expect((await requestBodyOf(app))?.required).toBeUndefined();
    expect(calls).toBe(0);
  });

  it("follows `describeRoute` for a body only a refinement requires", async () => {
    const app = new Hono().post(
      "/",
      describeRoute({ requestBody: { content: {}, required: true } }),
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
    expect((await requestBodyOf(app))?.required).toBe(true);
  });
});
