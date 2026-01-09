import { Hono } from "hono";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

describe("valibot", () => {
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
                  v.object({
                    message: v.string(),
                  }),
                ),
              },
            },
          },
        },
      }),
      validator("json", v.object({ message: v.string() })),
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
                  v.pipe(
                    v.object({
                      message: v.string(),
                    }),
                    v.metadata({ ref: "SuccessResponse" }),
                  ),
                ),
              },
            },
          },
        },
      }),
      validator("json", v.object({ message: v.string() })),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });

  it("with transformation", async () => {
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
                schema: resolver(v.string()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        v.object({
          names: v.pipe(
            v.string(),
            v.transform((val) => val.split("|")),
            v.array(v.string()),
          ),
        }),
        undefined,
        {
          options: { typeMode: "output" },
        },
      ),
      (c) => {
        const { names } = c.req.valid("query");
        return c.json({ message: `Hello ${names.join(", ")}!` });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });


    it("with unsupported schema", async () => {
        const app = new Hono().get(
            "/",
            describeRoute({
                responses: {
                    200: {
                        description: "Success",
                        content: {
                            "application/json": {
                                schema: resolver(v.string()),
                            },
                        },
                    },
                },
            }),
            validator(
                "query",
                v.object({
                  unrepresentable: v.record(
                      v.picklist(['table', 'boat']),
                      v.array(
                          v.variant('type', [
                              v.object({
                                  type: v.literal('table'),
                                  length: v.number(),
                              }),
                              v.object({
                                  type: v.literal('boat'),
                                  speed: v.number(),
                              }),
                          ])
                      )
                  )
                }),
                undefined,
                {
                    options: { typeMode: "output", errorMode: "ignore" },
                },
            ),
            async (c) => {
                const { unrepresentable } = await c.req.valid("query");
                return c.json({ message: `Hello` });
            },
        );

        const specs = await generateSpecs(app);

        expect(specs).toMatchSnapshot();
    });

});
