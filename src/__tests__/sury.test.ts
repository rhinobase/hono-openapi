import { Hono } from "hono";
import * as S from "sury";
import { describe, expect, it } from "vitest";
import { generateSpecs } from "../handler.js";
import {
  describeResponse,
  describeRoute,
  resolver,
  validator,
} from "../middlewares.js";

describe("sury", () => {
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
                  S.schema({
                    message: S.string,
                  }),
                ),
              },
            },
          },
        },
      }),
      validator("json", S.schema({ message: S.string })),
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
                  S.extendJSONSchema(
                    S.schema({
                      myString: S.string,
                      myUnion: S.union([S.number, S.boolean]),
                    }),
                    { $id: "SuccessResponse" },
                  ),
                ),
              },
            },
          },
        },
      }),
      validator("json", S.schema({ message: S.string })),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });

  it("describeResponse with Date schema matches c.json serialization", async () => {
    const ResponseSchema = S.schema({
      name: S.string,
      createdAt: S.datetime(S.string),
    });

    const app = new Hono().get(
      "/",
      describeResponse(
        (c) => {
          return c.json({ name: "test", createdAt: new Date() }, 200);
        },
        {
          200: {
            description: "OK",
            content: {
              "application/json": {
                vSchema: ResponseSchema,
              },
            },
          },
        },
      ),
    );

    const specs = await generateSpecs(app);

    expect(specs.paths["/"]?.get?.responses).toEqual({
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: expect.any(Object),
          },
        },
      },
    });
  });
});
