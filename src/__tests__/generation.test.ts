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
    { target: "json", media: undefined, expected: "application/json" },
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
});

describe("named parameter schemas", () => {
  it.each([
    {
      name: "Zod",
      schema: z
        .object({ name: z.string(), age: z.string().optional() })
        .meta({ ref: "Filters" }),
    },
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
