import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z, { type toJSONSchema } from "zod/v4";
import { generateSpecs } from "../handler.js";
import {
  describeResponse,
  describeRoute,
  resolver,
  validator,
} from "../middlewares.js";

describe("zod v4", () => {
  it("basic", async () => {
    const app = new Hono().get(
      "/",
      describeRoute({
        tags: ["test"],
        summary: "Test route",
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
      validator("json", z.object({ message: z.string() })),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });

  it("with metadata", async () => {
    const app = new Hono().get(
      "/",
      describeRoute({
        tags: ["test"],
        summary: "Test route",
        description: "This is a test route",
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: resolver(
                  z
                    .object({
                      message: z.string(),
                    })
                    .meta({ ref: "SuccessResponse" }),
                ),
              },
            },
          },
        },
      }),
      validator("json", z.object({ message: z.string() })),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });

  it("with options", async () => {
    // The option for z.toJSONSchema to support Date type
    // https://zod.dev/json-schema?id=override
    const zodToJsonOptions: Record<string, unknown> = {
      unrepresentable: "any",
      override: (ctx) => {
        const def = ctx.zodSchema._zod.def;
        if (def.type === "date") {
          ctx.jsonSchema.type = "string";
          ctx.jsonSchema.format = "date-time";
        }
      },
    } satisfies Parameters<typeof toJSONSchema>[1];

    const app = new Hono().get(
      "/",
      describeRoute({
        tags: ["test"],
        summary: "Test route",
        description: "This is a test route",
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    date: z.date(),
                  }),
                  zodToJsonOptions, // Passed to toJSONSchema
                  { options: zodToJsonOptions }, // Passed to toOpenAPISchema
                ),
              },
            },
          },
        },
      }),
      validator("json", z.object({ message: z.string() })),
      async (c) => {
        return c.json({ date: new Date(2000, 0, 1) });
      },
    );

    const specs = await generateSpecs(app);
    expect(specs).toMatchSnapshot();
  });

  it("with response description", async () => {
    const app = new Hono().get(
      "/",
      describeRoute({
        tags: ["test"],
        summary: "Test route",
        description: "This is a test route",
      }),
      validator("json", z.object({ message: z.string() })),
      describeResponse(
        (c) => {
          return c.json({ error: "some" }, 400);
        },
        {
          200: {
            description: "Success",
            content: {
              "application/json": {
                vSchema: z
                  .object({
                    message: z.string(),
                  })
                  .meta({ ref: "SuccessResponse" }),
              },
            },
          },
          400: {
            description: "Error",
            content: {
              "application/json": {
                vSchema: z.object({
                  error: z.string(),
                }),
              },
            },
          },
        },
      ),
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });
});
