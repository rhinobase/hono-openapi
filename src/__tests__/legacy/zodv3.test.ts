import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v3";
import "zod-openapi/extend";
import { generateSpecs } from "../../handler.js";
import {
  describeResponse,
  describeRoute,
  resolver,
  validator,
} from "../../middlewares.js";

describe("zod v3", () => {
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
                    .openapi({ ref: "SuccessResponse" }),
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

  it("with reference in parameter", async () => {
    const query = z.object({
      limit: z.coerce.number().default(10),
      offset: z.coerce.number().default(0),
    });

    const param = z
      .object({
        id: z.coerce.number(),
      })
      .openapi({ ref: "Param" });

    const app = new Hono().get(
      "/:id",
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
                    result: z.array(z.string()),
                    count: z.number(),
                  }),
                ),
              },
            },
          },
        },
      }),
      validator("param", param),
      validator("query", query),
      async (c) => {
        return c.json([]);
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });

  it("describeResponse", async () => {
    const query = z.object({
      limit: z.coerce.number().default(10),
      offset: z.coerce.number().default(0),
    });

    const param = z
      .object({
        id: z.coerce.number(),
      })
      .openapi({ ref: "Param" });

    const app = new Hono().get(
      "/:id",
      describeRoute({
        tags: ["test"],
        summary: "Test route",
        description: "This is a test route",
      }),
      validator("param", param),
      validator("query", query),
      describeResponse(
        async (c) => {
          c.req.valid("query");
          c.req.valid("param");

          return c.json({
            result: [],
            count: 0,
          });
        },
        {
          200: {
            description: "Success",
            content: {
              "application/json": {
                vSchema: z.object({
                  result: z.array(z.string()),
                  count: z.number(),
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
