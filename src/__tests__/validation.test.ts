import { type } from "arktype";
import { Schema } from "effect";
import { Hono } from "hono";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import z3 from "zod";
import z4 from "zod/v4";
import { generateSpecs, validator } from "../index.js";

describe("transformed query input", () => {
  it.each([
    {
      name: "Zod 3",
      schema: z3.object({
        count: z3.string().regex(/^\d+$/).transform(Number),
      }),
      options: {},
    },
    {
      name: "Zod 4",
      schema: z4.object({
        count: z4.string().regex(/^\d+$/).transform(Number),
      }),
      options: {},
    },
    {
      name: "Valibot",
      schema: v.object({
        count: v.pipe(
          v.string(),
          v.regex(/^\d+$/),
          v.transform(Number),
          v.number(),
        ),
      }),
      options: { typeMode: "input" },
    },
    {
      name: "ArkType",
      schema: type({ count: "string.integer.parse" }),
      options: {},
    },
    {
      name: "Effect",
      schema: Schema.standardSchemaV1(
        Schema.Struct({ count: Schema.NumberFromString }),
      ),
      options: {},
    },
  ])(
    "documents the input and passes the parsed output to the handler for $name",
    async ({ schema, options }) => {
      const app = new Hono().get(
        "/count",
        validator("query", schema, undefined, { options }),
        (c) => c.json(c.req.valid("query")),
      );
      const specs = await generateSpecs(app);
      expect(specs.paths["/count"]?.get?.parameters).toEqual([
        expect.objectContaining({
          name: "count",
          in: "query",
          required: true,
        }),
      ]);
      const parameter = specs.paths["/count"]?.get?.parameters?.[0];
      if (!parameter || !("schema" in parameter) || !parameter.schema) {
        throw new Error("Missing parameter schema");
      }
      const inputSchema =
        "$ref" in parameter.schema
          ? specs.components?.schemas?.[
              parameter.schema.$ref.slice("#/components/schemas/".length)
            ]
          : parameter.schema;
      expect(inputSchema).toMatchObject({ type: "string" });
      const response = await app.request("/count?count=2");
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ count: 2 });
      expect((await app.request("/count?count=invalid")).status).toBe(400);
    },
  );
});

describe("default query values", () => {
  it.each([
    {
      name: "Zod 3",
      schema: z3.object({ sort: z3.enum(["asc", "desc"]).default("asc") }),
    },
    {
      name: "Zod 4",
      schema: z4.object({ sort: z4.enum(["asc", "desc"]).default("asc") }),
    },
    {
      name: "Valibot",
      schema: v.object({
        sort: v.optional(v.picklist(["asc", "desc"]), "asc"),
      }),
    },
  ])(
    "keeps a defaulted $name field optional in the spec and supplies its runtime default",
    async ({ schema }) => {
      const app = new Hono().get("/users", validator("query", schema), (c) =>
        c.json(c.req.valid("query")),
      );
      const specs = await generateSpecs(app);
      const parameter = specs.paths["/users"]?.get?.parameters?.[0];
      expect(parameter).toMatchObject({
        name: "sort",
        schema: { enum: ["asc", "desc"], default: "asc" },
      });
      expect(parameter).not.toMatchObject({ required: true });
      expect(await (await app.request("/users")).json()).toEqual({
        sort: "asc",
      });
      expect(await (await app.request("/users?sort=desc")).json()).toEqual({
        sort: "desc",
      });
      expect((await app.request("/users?sort=other")).status).toBe(400);
    },
  );
});

describe("validator hooks", () => {
  it("awaits async validation and returns the hook response without running the handler", async () => {
    const schema = z4.object({
      name: z4.string().refine(async (name) => name === "available"),
    });
    let handled = false;
    const app = new Hono().post(
      "/users",
      validator("json", schema, async (result, c) => {
        if (!result.success)
          return c.json({ message: "Name unavailable" }, 422);
      }),
      (c) => {
        handled = true;
        return c.json(c.req.valid("json"));
      },
    );
    const request = (name: string) =>
      app.request("/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
    const rejected = await request("taken");
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toEqual({ message: "Name unavailable" });
    expect(handled).toBe(false);
    const accepted = await request("available");
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ name: "available" });
    expect(handled).toBe(true);
  });
});
