import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
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
                  })
                ),
              },
            },
          },
        },
      }),
      validator("json", z.object({ message: z.string() })),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      }
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
                    .meta({ ref: "SuccessResponse" })
                ),
              },
            },
          },
        },
      }),
      validator("json", z.object({ message: z.string() })),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      }
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
        async (c) => {
          try {
            return c.json({ message: "Hello World" }, 200);
          } catch (e) {
            console.error(e);
            return c.json({ error: e.message }, 400);
          }
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
        }
      )
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });

  it("with global validator", async () => {
    const app = new Hono()
      .use(validator("query", z.object({ q1: z.string() })))
      .get(
        "/",
        describeRoute({
          tags: ["test"],
          summary: "Test route",
          description: "This is a test route",
        }),
        validator("query", z.object({ q2: z.string() })),
        async (c) => {
          return c.json({ message: "Hello, world!" });
        }
      );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });
});
