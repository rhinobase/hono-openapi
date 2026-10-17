import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, validator } from "../middlewares.js";

const ok = { 200: { description: "OK" } };
const body = validator("json", z.object({ name: z.string() }));
const createPet = describeRoute({
  deprecated: false,
  operationId: "createPet",
  responses: ok,
  summary: "Create a pet",
});

describe("defaultOptions", () => {
  it.each([
    [
      "before",
      (app: Hono) => app.post("/pets", createPet, body, (c) => c.json({})),
    ],
    [
      "after",
      (app: Hono) => app.post("/pets", body, createPet, (c) => c.json({})),
    ],
  ])(
    "doesn't override what describeRoute sets %s a validator",
    async (_, route) => {
      const specs = await generateSpecs(route(new Hono()), {
        defaultOptions: {
          POST: {
            deprecated: true,
            operationId: "fallback",
            summary: "A default summary",
          },
        },
      });

      expect(specs.paths["/pets"]?.post).toMatchObject({
        deprecated: false,
        operationId: "createPet",
        summary: "Create a pet",
      });
    },
  );

  it("names only the operations that don't name themselves", async () => {
    const app = new Hono()
      .post("/pets", createPet, body, (c) => c.json({}))
      .post("/notes", body, (c) => c.json({}));

    const specs = await generateSpecs(app, {
      defaultOptions: {
        POST: { operationId: ({ path }) => `unnamed ${path}` },
      },
    });

    expect(specs.paths["/pets"]?.post?.operationId).toBe("createPet");
    expect(specs.paths["/notes"]?.post?.operationId).toBe("unnamed /notes");
  });
});
