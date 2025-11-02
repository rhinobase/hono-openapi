import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { generateSpecs } from "../handler.js";
import { jsonschema } from "../jsonschema/jsonschema.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

describe("jsonschema", () => {
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
                  jsonschema({
                    type: "object",
                    required: ["message"],
                    properties: {
                      message: { type: "string" },
                    },
                  }),
                ),
              },
            },
          },
        },
      }),
      validator(
        "json",
        jsonschema({
          type: "object",
          required: ["message"],
          properties: {
            message: { type: "string" },
          },
        }),
      ),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });

  it("with JSON Schema", async () => {
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
                  jsonschema({
                    type: "object",
                    required: ["x", "y", "z"],
                    properties: {
                      x: { type: "number" },
                      y: { type: "number" },
                      z: { type: "number" },
                    },
                  }),
                ),
              },
            },
          },
        },
      }),
      validator(
        "json",
        jsonschema({
          type: "object",
          required: ["message"],
          properties: {
            message: { type: "string" },
          },
        }),
      ),
      async (c) => {
        return c.json({ x: 1, y: 2, z: 3 });
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
                  jsonschema({
                    type: "object",
                    $id: "SuccessResponse",
                    required: ["message"],
                    properties: {
                      message: { type: "string" },
                    },
                  }),
                ),
              },
            },
          },
        },
      }),
      validator(
        "json",
        jsonschema({
          type: "object",
          required: ["message"],
          properties: {
            message: { type: "string" },
          },
        }),
      ),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });
});
