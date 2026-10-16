import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, validator } from "../middlewares.js";

const Pet = z.object({ name: z.string() });

const requestBodyOf = async (app: Hono, path: string) => {
  const specs = await generateSpecs(app);
  return specs.paths[path]?.post?.requestBody as
    | { description?: string; required?: boolean }
    | undefined;
};

describe("requestBody.required described with describeRoute", () => {
  it("keeps `required: false` described before the validator", async () => {
    const app = new Hono().post(
      "/pets",
      describeRoute({
        requestBody: {
          content: {},
          description: "Leave it out to add a pet with a generated name.",
          required: false,
        },
      }),
      validator("json", Pet),
      (c) => c.json({}),
    );

    expect(await requestBodyOf(app, "/pets")).toMatchObject({
      description: "Leave it out to add a pet with a generated name.",
      required: false,
    });
  });

  it("keeps `required: false` described after the validator", async () => {
    const app = new Hono().post(
      "/pets",
      validator("json", Pet),
      describeRoute({ requestBody: { content: {}, required: false } }),
      (c) => c.json({}),
    );

    expect((await requestBodyOf(app, "/pets"))?.required).toBe(false);
  });

  it("uses the validator's `required` when the route describes none", async () => {
    const app = new Hono().post(
      "/pets",
      describeRoute({
        requestBody: { content: {}, description: "The pet to add." },
      }),
      validator("json", Pet),
      (c) => c.json({}),
    );

    expect(await requestBodyOf(app, "/pets")).toMatchObject({
      description: "The pet to add.",
      required: true,
    });
  });
});
