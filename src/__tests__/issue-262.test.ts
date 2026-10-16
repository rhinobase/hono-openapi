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
