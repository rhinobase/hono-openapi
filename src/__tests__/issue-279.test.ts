import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, validator } from "../middlewares.js";

describe("default response", () => {
  it.each([
    {
      name: "only a validator",
      app: new Hono().get(
        "/health",
        validator("query", z.object({ verbose: z.string().optional() })),
        (c) => c.text("ok"),
      ),
    },
    {
      name: "describeRoute without responses",
      app: new Hono().get(
        "/health",
        describeRoute({ description: "Check the service" }),
        (c) => c.text("ok"),
      ),
    },
  ])("is described for a route with $name", async ({ app }) => {
    const specs = await generateSpecs(app);

    expect(specs.paths["/health"]?.get?.responses?.[200]).toEqual({
      description: "Successful response",
    });
  });

  it("isn't added to a route that documents its responses", async () => {
    const app = new Hono().get(
      "/health",
      describeRoute({ responses: { 204: { description: "Healthy" } } }),
      (c) => c.body(null, 204),
    );

    const specs = await generateSpecs(app);

    expect(specs.paths["/health"]?.get?.responses).toEqual({
      204: { description: "Healthy" },
    });
  });
});
