import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver } from "../middlewares.js";

const Version = z.string().meta({ description: "The API version" });
const Retry = z.object({ after: z.number().default(30) });

const operationOf = async (app: Hono) => {
  const specs = await generateSpecs(app);
  return { operation: specs.paths["/notes"]?.post, specs };
};

describe("resolver() in header schemas", () => {
  it("converts a response header's schema", async () => {
    const app = new Hono().post(
      "/notes",
      describeRoute({
        responses: {
          200: {
            description: "OK",
            headers: { "X-Version": { schema: resolver(Version) } },
          },
        },
      }),
      (c) => c.json({}),
    );

    const { operation } = await operationOf(app);

    expect(operation?.responses?.[200]).toMatchObject({
      headers: {
        "X-Version": {
          schema: { description: "The API version", type: "string" },
        },
      },
    });
  });

  it("converts an encoding header in a request body as input", async () => {
    const app = new Hono().post(
      "/notes",
      describeRoute({
        requestBody: {
          content: {
            "multipart/form-data": {
              encoding: {
                file: { headers: { "X-Retry": { schema: resolver(Retry) } } },
              },
              schema: resolver(z.object({ file: z.string() })),
            },
          },
        },
        responses: { 204: { description: "No Content" } },
      }),
      (c) => c.body(null, 204),
    );

    const { operation } = await operationOf(app);
    const requestBody = operation?.requestBody as {
      content: Record<string, { encoding: Record<string, unknown> }>;
    };

    expect(requestBody.content["multipart/form-data"].encoding).toMatchObject({
      file: {
        headers: {
          "X-Retry": {
            schema: {
              properties: { after: { default: 30, type: "number" } },
              type: "object",
            },
          },
        },
      },
    });
    expect(
      (
        requestBody.content["multipart/form-data"].encoding.file as {
          headers: Record<string, { schema: { required?: string[] } }>;
        }
      ).headers["X-Retry"].schema.required,
    ).toBeUndefined();
  });

  it("converts an encoding header in a response as output", async () => {
    const app = new Hono().post(
      "/notes",
      describeRoute({
        responses: {
          200: {
            content: {
              "multipart/mixed": {
                encoding: {
                  part: { headers: { "X-Retry": { schema: resolver(Retry) } } },
                },
                schema: resolver(z.object({ part: z.string() })),
              },
            },
            description: "OK",
          },
        },
      }),
      (c) => c.json({}),
    );

    const { operation } = await operationOf(app);

    expect(operation?.responses?.[200]).toMatchObject({
      content: {
        "multipart/mixed": {
          encoding: {
            part: {
              headers: { "X-Retry": { schema: { required: ["after"] } } },
            },
          },
        },
      },
    });
  });

  it("gives a named header schema its own component", async () => {
    const NamedVersion = Version.meta({ ref: "Version" });
    const app = new Hono().post(
      "/notes",
      describeRoute({
        responses: {
          200: {
            description: "OK",
            headers: { "X-Version": { schema: resolver(NamedVersion) } },
          },
        },
      }),
      (c) => c.json({}),
    );

    const { operation, specs } = await operationOf(app);

    expect(operation?.responses?.[200]).toMatchObject({
      headers: {
        "X-Version": { schema: { $ref: "#/components/schemas/Version" } },
      },
    });
    expect(specs.components?.schemas?.Version).toMatchObject({
      description: "The API version",
      type: "string",
    });
  });

  it("leaves a header described with a plain schema as it is", async () => {
    const header = {
      schema: { type: "integer" as const },
      description: "Retry",
    };
    const app = new Hono().post(
      "/notes",
      describeRoute({
        responses: {
          200: { description: "OK", headers: { "Retry-After": header } },
        },
      }),
      (c) => c.json({}),
    );

    const { operation } = await operationOf(app);

    expect(operation?.responses?.[200]).toEqual({
      description: "OK",
      headers: { "Retry-After": header },
    });
  });

  it("leaves a header with a boolean schema as it is", async () => {
    // `true` and `false` are valid JSON Schema, which the OpenAPI types don't describe.
    const headers = {
      "X-Anything": { schema: true },
      "X-Nothing": { schema: false },
    } as never;
    const app = new Hono().post(
      "/notes",
      describeRoute({
        responses: {
          200: {
            content: {
              "multipart/mixed": {
                encoding: { part: { headers } },
                schema: resolver(z.object({ part: z.string() })),
              },
            },
            description: "OK",
            headers,
          },
        },
      }),
      (c) => c.json({}),
    );

    const { operation } = await operationOf(app);

    expect(operation?.responses?.[200]).toMatchObject({
      content: {
        "multipart/mixed": { encoding: { part: { headers } } },
      },
      headers,
    });
  });

  it("leaves an encoding header with a boolean schema in a request body as it is", async () => {
    const headers = { "X-Anything": { schema: true } } as never;
    const app = new Hono().post(
      "/notes",
      describeRoute({
        requestBody: {
          content: {
            "multipart/form-data": {
              encoding: { file: { headers } },
              schema: resolver(z.object({ file: z.string() })),
            },
          },
        },
        responses: { 204: { description: "No Content" } },
      }),
      (c) => c.body(null, 204),
    );

    const { operation } = await operationOf(app);

    expect(operation?.requestBody).toMatchObject({
      content: { "multipart/form-data": { encoding: { file: { headers } } } },
    });
  });

  it("converts a header of a response documented as a component", async () => {
    const specs = await generateSpecs(new Hono(), {
      documentation: {
        components: {
          responses: {
            Versioned: {
              description: "OK",
              headers: { "X-Version": { schema: resolver(Version) } },
            },
          },
        },
      },
    });

    expect(specs.components?.responses?.Versioned).toMatchObject({
      headers: {
        "X-Version": {
          schema: { description: "The API version", type: "string" },
        },
      },
    });
  });
});
