import type { StandardSchemaV1 } from "@standard-schema/spec";
import { type } from "arktype";
import { Schema } from "effect";
import { Hono } from "hono";
import * as S from "sury";
import Type from "typebox";
import { Compile } from "typebox/compile";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import z3 from "zod";
import z4 from "zod/v4";
import { generateSpecs, validator } from "../index.js";

// Equivalent inputs, expressed in each vendor's own schema API. Keep the
// expectations about HTTP behavior and documentation shared across adapters.
const vendors = [
  {
    name: "Zod 3",
    schema: z3.object({
      name: z3.string(),
      alias: z3.string().optional(),
      note: z3.string().nullable(),
    }),
    nullable: { type: ["string", "null"] },
  },
  {
    name: "Zod 4",
    schema: z4.object({
      name: z4.string(),
      alias: z4.string().optional(),
      note: z4.string().nullable(),
    }),
    nullable: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  {
    name: "Valibot",
    schema: v.object({
      name: v.string(),
      alias: v.optional(v.string()),
      note: v.nullable(v.string()),
    }),
    nullable: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  {
    name: "ArkType",
    schema: type({ name: "string", "alias?": "string", note: "string | null" }),
    nullable: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  {
    name: "Effect",
    schema: Schema.standardSchemaV1(
      Schema.Struct({
        name: Schema.String,
        alias: Schema.optional(Schema.String),
        note: Schema.NullOr(Schema.String),
      }),
    ),
    nullable: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  {
    name: "TypeBox",
    schema: Compile(
      Type.Object({
        name: Type.String(),
        alias: Type.Optional(Type.String()),
        note: Type.Union([Type.String(), Type.Null()]),
      }),
    ),
    nullable: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  {
    name: "Sury",
    schema: S.schema({
      name: S.string,
      alias: S.optional(S.string),
      note: S.union([S.string, S.schema(null)]),
    }),
    nullable: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
] satisfies { name: string; schema: StandardSchemaV1; nullable: object }[];

describe.each(vendors)("$name request contract", ({ schema, nullable }) => {
  it("documents optional and nullable fields without changing validated input", async () => {
    const app = new Hono().post("/users", validator("json", schema), (c) =>
      c.json(c.req.valid("json")),
    );
    const specs = await generateSpecs(app);
    const body = specs.paths["/users"]?.post?.requestBody;
    expect(body).toMatchObject({ required: true });
    if (!body || !("content" in body)) throw new Error("Missing request body");
    expect(body.content["application/json"].schema).toMatchObject({
      type: "object",
      properties: {
        name: { type: "string" },
        alias: { type: "string" },
        note: nullable,
      },
    });
    const jsonSchema = body.content["application/json"].schema;
    if (!jsonSchema || !("required" in jsonSchema))
      throw new Error("Missing required fields");
    expect(jsonSchema.required?.slice().sort()).toEqual(["name", "note"]);

    for (const input of [
      { name: "Ada", note: null },
      { name: "Ada", alias: "A", note: "hello" },
    ]) {
      const response = await app.request("/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(input);
    }
  });

  it("rejects missing required fields and wrong types before calling the handler", async () => {
    let handled = false;
    const app = new Hono().post("/users", validator("json", schema), (c) => {
      handled = true;
      return c.json({ accepted: true });
    });
    for (const input of [{ name: "Ada" }, { name: 42, note: null }]) {
      const response = await app.request("/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result).toMatchObject({ success: false, data: input });
      expect(result.error).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: expect.any(String) }),
        ]),
      );
    }
    expect(handled).toBe(false);
  });
});
