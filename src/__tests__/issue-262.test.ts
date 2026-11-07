import { Hono } from "hono";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import z3 from "zod";
import "zod-openapi/extend";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

type Schema = {
  properties?: Record<string, Record<string, unknown>>;
  required?: string[];
  type?: string;
};

const operationOf = async (app: Hono, path: string, method: "get" | "post") => {
  const specs = await generateSpecs(app);
  const operation = specs.paths[path]?.[method] as {
    requestBody?: { content: Record<string, { schema: Schema }> };
    responses: Record<string, { content: Record<string, { schema: Schema }> }>;
  };

  return {
    request: operation.requestBody?.content["application/json"]?.schema,
    response: operation.responses["200"]?.content["application/json"]?.schema,
  };
};

const json = (schema: Parameters<typeof resolver>[0], options?: object) => ({
  200: {
    description: "OK",
    content: { "application/json": { schema: resolver(schema, options) } },
  },
});

describe("response schemas", () => {
  it("require a Zod v4 field with a default, which a request body may leave out", async () => {
    const Note = z.object({
      pinned: z.boolean().default(false),
      title: z.string(),
    });
    const app = new Hono().post(
      "/notes",
      describeRoute({ responses: json(Note) }),
      validator("json", Note),
      (c) => c.json(c.req.valid("json")),
    );

    const response = await app.request("/notes", {
      body: JSON.stringify({ title: "Groceries" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(await response.json()).toEqual({
      pinned: false,
      title: "Groceries",
    });

    const { request, response: responseSchema } = await operationOf(
      app,
      "/notes",
      "post",
    );
    expect(request?.required).toEqual(["title"]);
    expect(responseSchema?.required).toEqual(["pinned", "title"]);
  });

  it("require a Zod v3 field with a default", async () => {
    const Note = z3.object({
      pinned: z3.boolean().default(false),
      title: z3.string(),
    });
    const app = new Hono().get(
      "/notes",
      describeRoute({ responses: json(Note) }),
      (c) => c.json(Note.parse({ title: "Groceries" })),
    );

    const { response } = await operationOf(app, "/notes", "get");
    expect(response?.required).toEqual(["pinned", "title"]);
  });

  it("describe what a Valibot transformation produces", async () => {
    const Count = v.object({
      count: v.pipe(
        v.string(),
        v.minLength(1),
        v.transform(Number),
        v.number(),
      ),
    });
    const app = new Hono().get(
      "/count",
      describeRoute({ responses: json(Count) }),
      (c) => c.json(v.parse(Count, { count: "3" })),
    );

    const { response } = await operationOf(app, "/count", "get");
    expect(response?.properties?.count).toEqual({ type: "number" });
  });

  it("keep converting as input when the resolver asks for it", async () => {
    const Note = z.object({
      pinned: z.boolean().default(false),
      title: z.string(),
    });
    const app = new Hono().get(
      "/notes",
      describeRoute({ responses: json(Note, { options: { io: "input" } }) }),
      (c) => c.json(Note.parse({ title: "Groceries" })),
    );

    const { response } = await operationOf(app, "/notes", "get");
    expect(response?.required).toEqual(["title"]);
  });
});

describe("a named schema used for both a request body and a response", () => {
  const Note = z
    .object({ pinned: z.boolean().default(false), title: z.string() })
    .meta({ ref: "Note" });

  // The validator and `describeRoute` can come in either order; the request
  // body must keep describing what the validator accepts in both.
  const orders = {
    "validator first": (app: Hono) =>
      app.post(
        "/notes",
        validator("json", Note),
        describeRoute({ responses: json(Note) }),
        (c) => c.json(c.req.valid("json")),
      ),
    "describeRoute first": (app: Hono) =>
      app.post(
        "/notes",
        describeRoute({ responses: json(Note) }),
        validator("json", Note),
        (c) => c.json(c.req.valid("json")),
      ),
  };

  it.each(Object.entries(orders))(
    "keeps the request body on its input shape with the %s",
    async (_, register) => {
      const specs = await generateSpecs(register(new Hono()));
      const operation = specs.paths["/notes"]?.post as {
        requestBody: { content: Record<string, { schema: { $ref: string } }> };
        responses: Record<
          string,
          { content: Record<string, { schema: { $ref: string } }> }
        >;
      };
      const component = ($ref: string) =>
        specs.components?.schemas?.[$ref.split("/").at(-1) ?? ""] as Schema & {
          additionalProperties?: boolean;
        };

      const request = component(
        operation.requestBody.content["application/json"].schema.$ref,
      );
      const response = component(
        operation.responses["200"].content["application/json"].schema.$ref,
      );

      expect(request.required).toEqual(["title"]);
      expect(request.additionalProperties).toBeUndefined();
      expect(response.required).toEqual(["pinned", "title"]);
    },
  );
});

describe("a Zod v3 transformation without an output type", () => {
  // `zod-openapi` can't tell what a bare `.transform()` produces, so it can't
  // convert the schema as output.
  const Pet = z3.object({
    age: z3.string().transform(Number),
    name: z3.string(),
  });

  it("documents a response as what it accepts", async () => {
    const app = new Hono().get(
      "/pets",
      describeRoute({ responses: json(Pet) }),
      (c) => c.json(Pet.parse({ age: "3", name: "Rex" })),
    );

    const { response } = await operationOf(app, "/pets", "get");
    expect(response).toEqual({
      properties: { age: { type: "string" }, name: { type: "string" } },
      required: ["age", "name"],
      type: "object",
    });
  });

  it("documents a response header as what it accepts", async () => {
    const app = new Hono().get(
      "/pets",
      describeRoute({
        responses: {
          200: {
            description: "OK",
            headers: {
              "X-Total-Count": {
                schema: resolver(z3.string().transform(Number)),
              },
            },
          },
        },
      }),
      (c) => c.json([]),
    );

    const specs = await generateSpecs(app);
    expect(specs.paths["/pets"]?.get?.responses?.["200"]).toEqual({
      description: "OK",
      headers: { "X-Total-Count": { schema: { type: "string" } } },
    });
  });

  it("documents a webhook's request body as what it accepts", async () => {
    const specs = await generateSpecs(new Hono(), {
      documentation: {
        webhooks: {
          "pet.adopted": {
            post: {
              requestBody: {
                content: { "application/json": { schema: resolver(Pet) } },
              },
            },
          },
        },
      },
    });

    expect(specs.webhooks?.["pet.adopted"]).toEqual({
      post: {
        requestBody: {
          content: {
            "application/json": {
              schema: {
                properties: {
                  age: { type: "string" },
                  name: { type: "string" },
                },
                required: ["age", "name"],
                type: "object",
              },
            },
          },
        },
      },
    });
  });

  it("still fails when the resolver asks for the output form", async () => {
    const app = new Hono().get(
      "/pets",
      describeRoute({
        responses: json(Pet, { options: { schemaType: "output" } }),
      }),
      (c) => c.json(Pet.parse({ age: "3", name: "Rex" })),
    );

    await expect(generateSpecs(app)).rejects.toThrow(
      "Failed to determine a type for ZodEffects - transform",
    );
  });
});
