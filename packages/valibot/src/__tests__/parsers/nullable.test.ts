import * as v from "valibot";
import { createSchema } from "valibot-openapi";
import type { Schema, Schema3_1 } from "../types";

describe("Create nullable schema", () => {
  describe("openapi 3.0.0", () => {
    it("creates a simple nullable string schema", () => {
      const expected: Schema = {
        type: "string",
        nullable: true,
      };

      const schema = v.nullable(v.string());

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it.skip("creates an allOf nullable schema for registered schemas", () => {
      const expected: Schema = {
        allOf: [{ $ref: "#/components/schemas/a" }],
        nullable: true,
      };

      const registered = v.pipe(v.string(), v.metadata({ ref: "a" }));
      const schema = v.nullable(v.optional(registered));

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates an anyOf nullable schema", () => {
      const expected: Schema = {
        anyOf: [
          {
            type: "object",
            properties: {
              a: {
                type: "string",
              },
            },
            required: ["a"],
          },
          {
            type: "object",
            properties: {
              b: {
                type: "string",
              },
            },
            required: ["b"],
          },
        ],
        nullable: true,
      };

      const schema = v.nullable(
        v.union([v.object({ a: v.string() }), v.object({ b: v.string() })])
      );

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it.skip("creates a nullable allOf nullable schema", () => {
      const expected: Schema = {
        type: "object",
        properties: {
          b: {
            allOf: [{ $ref: "#/components/schemas/a" }],
            properties: { b: { type: "string" } },
            required: ["b"],
            nullable: true,
          },
        },
        required: ["b"],
        nullable: true,
      };

      const object1 = v.pipe(
        v.object({ a: v.string() }),
        v.metadata({ ref: "a" })
      );
      const object2 = v.object({
        ...object1.entries,
        b: v.string(),
      });
      const schema = v.nullable(v.object({ b: v.nullable(object2) }));

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates a nullable enum", () => {
      const expected: Schema = {
        type: "string",
        nullable: true,
        enum: ["a", null],
      };

      const schema = v.nullable(v.picklist(["a"]));

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });
  });

  describe("openapi 3.1.0", () => {
    it("creates a simple nullable string schema", () => {
      const expected: Schema3_1 = {
        type: ["string", "null"],
      };

      const schema = v.nullable(v.string());

      const result = createSchema(schema, { version: "3.1.0" });

      expect(result.schema).toStrictEqual(expected);
    });

    it.skip("creates an oneOf nullable schema for registered schemas", () => {
      const expected: Schema3_1 = {
        oneOf: [
          {
            $ref: "#/components/schemas/a",
          },
          {
            type: "null",
          },
        ],
      };

      const registered = v.pipe(v.string(), v.metadata({ ref: "a" }));
      const schema = v.nullable(v.optional(registered));

      const result = createSchema(schema, { version: "3.1.0" });

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates an anyOf nullable schema", () => {
      const expected: Schema3_1 = {
        anyOf: [
          {
            type: "object",
            properties: {
              a: {
                type: "string",
              },
            },
            required: ["a"],
          },
          {
            type: "object",
            properties: {
              b: {
                type: "string",
              },
            },
            required: ["b"],
          },
          {
            type: "null",
          },
        ],
      };

      const schema = v.nullable(
        v.union([v.object({ a: v.string() }), v.object({ b: v.string() })])
      );

      const result = createSchema(schema, { version: "3.1.0" });

      expect(result.schema).toStrictEqual(expected);
    });

    it.skip("creates a nullable allOf nullable schema", () => {
      const expected: Schema3_1 = {
        type: ["object", "null"],
        properties: {
          b: {
            oneOf: [
              {
                allOf: [{ $ref: "#/components/schemas/a" }],
                properties: { b: { type: "string" } },
                required: ["b"],
              },
              { type: "null" },
            ],
          },
        },
        required: ["b"],
      };

      const object1 = v.pipe(
        v.object({ a: v.string() }),
        v.metadata({ ref: "a" })
      );
      const object2 = v.object({ ...object1.entries, b: v.string() });
      const schema = v.nullable(v.object({ b: v.nullable(object2) }));

      const result = createSchema(schema, { version: "3.1.0" });

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates a nullable enum", () => {
      const expected: Schema3_1 = {
        type: ["string", "null"],
        enum: ["a"],
      };

      const schema = v.nullable(v.picklist(["a"]));

      const result = createSchema(schema, { version: "3.1.0" });

      expect(result.schema).toStrictEqual(expected);
    });
  });
});
