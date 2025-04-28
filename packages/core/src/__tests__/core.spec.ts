import { Hono } from "hono";
import z from "zod";
import { generateSpecs } from "../openapi";
import { describeRoute } from "../route";
import { resolver, validator } from "../zod";

describe("parameters should be merged", () => {
  it("multiple same parameters in resolvers", async () => {
    const app = new Hono().get(
      "/",
      validator("param", z.object({ id: z.string() })),
      validator("param", z.object({ id: z.string() })),
    );

    const result = await generateSpecs(app);

    const parameters = result.paths["/"]?.get?.parameters;

    expect(parameters).toEqual([
      {
        name: "id",
        in: "param",
        required: true,
        schema: {
          type: "string",
        },
      },
    ]);
  });

  it("multiple similar parameters in resolvers", async () => {
    const app = new Hono().get(
      "/",
      validator("param", z.object({ id: z.string() })),
      validator(
        "param",
        z.object({ name: z.string().optional(), id: z.string() }),
      ),
    );

    const result = await generateSpecs(app);

    const parameters = result.paths["/"]?.get?.parameters;

    expect(parameters).toEqual([
      {
        name: "id",
        in: "param",
        required: true,
        schema: {
          type: "string",
        },
      },
      {
        name: "name",
        in: "param",
        required: false,
        schema: {
          type: "string",
        },
      },
    ]);
  });

  it("validator with static schema in describeRoute", async () => {
    const app = new Hono().get(
      "/",
      describeRoute({
        parameters: [
          {
            name: "id",
            in: "param",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
      }),
      validator("param", z.object({ id: z.string() })),
    );

    const result = await generateSpecs(app);

    const parameters = result.paths["/"]?.get?.parameters;

    expect(parameters).toEqual([
      {
        name: "id",
        in: "param",
        required: true,
        schema: {
          type: "string",
        },
      },
    ]);
  });

  it("validator with resolved schema in describeRoute", async () => {
    const app = new Hono().get(
      "/",
      describeRoute({
        parameters: [
          {
            name: "id",
            in: "param",
            required: true,
            schema: resolver(z.string()),
          },
        ],
      }),
      validator("param", z.object({ id: z.string() })),
    );

    const result = await generateSpecs(app);

    const parameters = result.paths["/"]?.get?.parameters;

    expect(parameters).toEqual([
      {
        name: "id",
        in: "param",
        required: true,
        schema: {
          type: "string",
        },
      },
    ]);
  });
});

describe("describeRoute with .use", () => {
  it("should merge properties", async () => {
    const app = new Hono()
      .use(
        describeRoute({
          responses: {
            "400": {
              description: "Bad Request",
              content: {
                "text/plain": {
                  schema: resolver(z.string()),
                },
              },
            },
          },
        }),
      )
      .get(
        "/",
        describeRoute({
          responses: {
            "200": {
              description: "OK",
              content: {
                "text/plain": {
                  schema: resolver(z.string()),
                },
              },
            },
          },
        }),
        validator("param", z.object({ id: z.string() })),
        (c) => {
          return c.text("Hello");
        },
      );

    const result = await generateSpecs(app);

    const path = result.paths["/"];

    expect(path).toEqual({
      get: {
        operationId: "getIndex",
        parameters: [
          {
            name: "id",
            in: "param",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "text/plain": {
                schema: {
                  type: "string",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "text/plain": {
                schema: {
                  type: "string",
                },
              },
            },
          },
        },
      },
    });
  });

  it("should generate unique tags", async () => {
    const app = new Hono()
      .use(
        describeRoute({
          tags: ["test"],
          responses: {
            "400": {
              description: "Bad Request",
              content: {
                "text/plain": {
                  schema: resolver(z.string()),
                },
              },
            },
          },
        }),
      )
      .get(
        "/",
        describeRoute({
          tags: ["test"],
          responses: {
            "200": {
              description: "OK",
              content: {
                "text/plain": {
                  schema: resolver(z.string()),
                },
              },
            },
          },
        }),
        validator("param", z.object({ id: z.string() })),
        (c) => {
          return c.text("Hello");
        },
      );

    const result = await generateSpecs(app);

    const path = result.paths["/"];

    expect(path).toEqual({
      get: {
        operationId: "getIndex",
        tags: ["test"],
        parameters: [
          {
            name: "id",
            in: "param",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "text/plain": {
                schema: {
                  type: "string",
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "text/plain": {
                schema: {
                  type: "string",
                },
              },
            },
          },
        },
      },
    });
  });
});
