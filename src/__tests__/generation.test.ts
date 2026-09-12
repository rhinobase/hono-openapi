import { Schema } from "effect";
import { Hono } from "hono";
import type { OpenAPIV3_1 } from "openapi-types";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import {
  describeRoute,
  generateSpecs,
  openAPIRouteHandler,
  resolver,
  validator,
} from "../index.js";

describe("request body media", () => {
  it.each([
    { target: "form", media: undefined, expected: "multipart/form-data" },
    {
      target: "form",
      media: "application/x-www-form-urlencoded",
      expected: "application/x-www-form-urlencoded",
    },
    {
      target: "json",
      media: "application/vnd.api+json",
      expected: "application/vnd.api+json",
    },
  ] as const)(
    "documents $target with media $media as $expected",
    async ({ target, media, expected }) => {
      const app = new Hono().post(
        "/users",
        validator(target, z.object({ name: z.string() }), undefined, { media }),
        (c) => c.json(c.req.valid(target)),
      );
      const specs = await generateSpecs(app);
      const body = specs.paths["/users"]?.post?.requestBody;
      if (!body || !("content" in body))
        throw new Error("Missing request body");
      expect(Object.keys(body.content)).toEqual([expected]);
      expect(body.content[expected].schema).toMatchObject({
        properties: { name: { type: "string" } },
      });

      const requestBody =
        expected === "multipart/form-data"
          ? new FormData()
          : expected === "application/x-www-form-urlencoded"
            ? "name=Ada"
            : JSON.stringify({ name: "Ada" });
      if (requestBody instanceof FormData) requestBody.set("name", "Ada");
      const response = await app.request("/users", {
        method: "POST",
        headers:
          requestBody instanceof FormData
            ? undefined
            : { "content-type": expected },
        body: requestBody,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ name: "Ada" });
    },
  );

  it("keeps every media type when a route accepts JSON and form data", async () => {
    const jsonSchema = z.object({ jsonName: z.string() });
    const formSchema = z.object({ formName: z.string() });
    const app = new Hono().post(
      "/users",
      validator("json", jsonSchema),
      validator("form", formSchema),
      (c) => c.json({ ok: true }),
    );

    const specs = await generateSpecs(app);
    const body = specs.paths["/users"]?.post?.requestBody;
    if (!body || !("content" in body)) {
      throw new Error("Missing request body");
    }

    expect(Object.keys(body.content).sort()).toEqual([
      "application/json",
      "multipart/form-data",
    ]);
    expect(body.content["application/json"].schema).toMatchObject({
      properties: { jsonName: { type: "string" } },
    });
    expect(body.content["multipart/form-data"].schema).toMatchObject({
      properties: { formName: { type: "string" } },
    });
  });

  it("does not combine request body references with inline content", async () => {
    const reference = { $ref: "#/components/requestBodies/Example" };
    const jsonValidator = validator("json", z.object({ name: z.string() }));
    const generateRequestBody = async (
      ...handlers: Parameters<Hono["post"]>
    ) => {
      const app = new Hono().post("/users", ...handlers, (c) =>
        c.json({ ok: true }),
      );
      return (await generateSpecs(app)).paths["/users"]?.post?.requestBody;
    };

    const referenceThenValidator = await generateRequestBody(
      describeRoute({ requestBody: reference }),
      jsonValidator,
    );
    expect(referenceThenValidator).toMatchObject({
      content: {
        "application/json": expect.any(Object),
      },
    });
    expect(referenceThenValidator).not.toHaveProperty("$ref");

    const validatorThenReference = await generateRequestBody(
      jsonValidator,
      describeRoute({ requestBody: reference }),
    );
    expect(validatorThenReference).toEqual(reference);
  });
});

describe("named parameter schemas", () => {
  it.each([
    {
      name: "Effect",
      schema: Schema.standardSchemaV1(
        Schema.Struct({
          name: Schema.String,
          age: Schema.optional(Schema.String),
        }).annotations({ identifier: "Filters" }),
      ),
    },
    {
      name: "referenced intersection",
      schema: z
        .intersection(
          z.object({ name: z.string() }).meta({ ref: "Name" }),
          z.object({ age: z.string().optional() }).meta({ ref: "Age" }),
        )
        .meta({ ref: "Filters" }),
    },
  ])("keeps every field and its optionality for $name", async ({ schema }) => {
    const app = new Hono().get("/users", validator("query", schema), (c) =>
      c.json(c.req.valid("query")),
    );
    const specs = await generateSpecs(app);
    const parameters = specs.paths["/users"]?.get?.parameters?.map(
      (parameter) => {
        if (!("$ref" in parameter)) return parameter;
        const key = parameter.$ref.slice("#/components/parameters/".length);
        return specs.components?.parameters?.[key];
      },
    ) as OpenAPIV3_1.ParameterObject[];
    expect(parameters).toHaveLength(2);
    expect(parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: "query",
          name: "name",
          required: true,
          schema: { type: "string" },
        }),
        expect.objectContaining({
          in: "query",
          name: "age",
          schema: { type: "string" },
        }),
      ]),
    );
    expect(parameters.find((p) => p.name === "age")?.required).not.toBe(true);
  });

  it.each([
    {
      name: "one-field",
      schema: z.object({ name: z.string() }),
      expected: [
        { in: "query", name: "name", required: true },
        { in: "header", name: "name", required: true },
      ],
    },
    {
      name: "multi-field",
      schema: z.object({ name: z.string(), age: z.string().optional() }),
      expected: [
        { in: "query", name: "name", required: true },
        { in: "header", name: "name", required: true },
        { in: "query", name: "age", required: false },
        { in: "header", name: "age", required: false },
      ],
    },
  ])(
    "keeps query and header parameters distinct for a shared $name object",
    async ({ schema, expected }) => {
      const filters = schema.meta({ ref: "Filters" });
      const app = new Hono().get(
        "/users",
        validator("query", filters),
        validator("header", filters),
        (c) =>
          c.json({
            query: c.req.valid("query"),
            header: c.req.valid("header"),
          }),
      );
      const specs = await generateSpecs(app);
      const parameters = specs.paths["/users"]?.get?.parameters?.map(
        (parameter) => {
          if (!("$ref" in parameter)) return parameter;
          return specs.components?.parameters?.[
            parameter.$ref.slice("#/components/parameters/".length)
          ];
        },
      );
      expect(parameters).toHaveLength(expected.length);
      expect(
        parameters?.map((parameter) => {
          if (!parameter || !("in" in parameter))
            throw new Error("Missing parameter definition");
          return {
            in: parameter.in,
            name: parameter.name,
            required: parameter.required ?? false,
          };
        }),
      ).toEqual(expect.arrayContaining(expected));
      const response = await app.request("/users?name=query", {
        headers: { name: "header" },
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        query: { name: "query" },
        header: { name: "header" },
      });
    },
  );
});

describe("generation lifecycle", () => {
  it("isolates middleware metadata when two apps generate specs concurrently", async () => {
    const createApp = (tag: string) =>
      new Hono()
        .use("/api/*", describeRoute({ tags: [tag] }))
        .get(
          "/api/items",
          validator("query", z.object({ q: z.string() })),
          (c) => c.json(c.req.valid("query")),
        )
        .get("/api/plain", (c) => c.json({ ok: true }));
    const leftApp = createApp("left");
    const rightApp = createApp("right");
    // First conversion is asynchronous; both apps register middleware before
    // their endpoint schemas finish. No sleeps or timing thresholds needed.
    const [left, right] = await Promise.all([
      generateSpecs(leftApp, { includeEmptyPaths: true }),
      generateSpecs(rightApp, { includeEmptyPaths: true }),
    ]);
    expect(left.paths["/api/items"]?.get?.tags).toEqual(["left"]);
    expect(right.paths["/api/items"]?.get?.tags).toEqual(["right"]);
    expect(left.paths["/api/plain"]?.get?.tags).toEqual(["left"]);
    expect(right.paths["/api/plain"]?.get?.tags).toEqual(["right"]);
    expect(await generateSpecs(leftApp, { includeEmptyPaths: true })).toEqual(
      left,
    );
  });

  it("serves complete references on repeated requests with a recreated OpenAPI handler", async () => {
    const user = z.object({ name: z.string() }).meta({ ref: "User" });
    const app = new Hono().get(
      "/users",
      describeRoute({
        responses: {
          200: {
            description: "Users",
            content: {
              "application/json": { schema: resolver(z.array(user)) },
            },
          },
        },
      }),
      (c) => c.json([{ name: "Ada" }]),
    );
    app.get("/openapi.json", (c, next) => openAPIRouteHandler(app)(c, next));
    const first = await (await app.request("/openapi.json")).json();
    const second = await (await app.request("/openapi.json")).json();
    expect(first).toEqual(second);
    expect(
      second.paths["/users"].get.responses[200].content["application/json"]
        .schema,
    ).toEqual({ type: "array", items: { $ref: "#/components/schemas/User" } });
    expect(second.components.schemas.User).toMatchObject({
      type: "object",
      properties: { name: { type: "string" } },
    });
  });
});
