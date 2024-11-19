import * as v from "valibot";
import { createSchema } from "../../index";
import type { Schema, Schema3_1 } from "../types";

describe("Create record schema", () => {
  it("creates an object schema with additional properties in 3.0.0", () => {
    const expected: Schema = {
      type: "object",
      additionalProperties: {
        type: "string",
      },
    };

    const schema = v.record(v.string(), v.string());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates an object schema with propertyNames in 3.1.0", () => {
    const expected: Schema3_1 = {
      type: "object",
      propertyNames: {
        type: "string",
        pattern: "^foo",
      },
      additionalProperties: {
        type: "string",
      },
    };

    const schema = v.record(v.pipe(v.string(), v.regex(/^foo/)), v.string());

    const result = createSchema(schema, { version: "3.1.0" });

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates an object schema with additional properties and key properties in 3.0.0", () => {
    const expected: Schema = {
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: "string" },
      },
      additionalProperties: false,
    };

    const schema = v.record(v.picklist(["a", "b"]), v.string());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("unwraps the a key schema in 3.0.0", () => {
    const basicEnum = v.picklist(["A", "B"]);
    const complexSchema = v.pipe(
      v.string(),
      v.trim(),
      v.length(1),
      v.transform((val) => val.toUpperCase()),
      basicEnum
    );

    const schema = v.record(complexSchema, v.string());

    const expected: Schema = {
      type: "object",
      properties: {
        A: { type: "string" },
        B: { type: "string" },
      },
      additionalProperties: false,
    };

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("supports registering the value schema in 3.0.0", () => {
    const basicEnum = v.picklist(["A", "B"]);
    const complexSchema = v.pipe(
      v.string(),
      v.trim(),
      v.length(1),
      v.transform((val) => val.toUpperCase()),
      basicEnum
    );

    const schema = v.record(
      complexSchema,
      v.pipe(v.string(), v.metadata({ ref: "value" }))
    );

    const expected: Schema = {
      type: "object",
      properties: {
        A: { $ref: "#/components/schemas/value" },
        B: { $ref: "#/components/schemas/value" },
      },
      additionalProperties: false,
    };

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("supports registering key enum schemas in 3.0.0", () => {
    const basicEnum = v.picklist(["A", "B"]);

    const complexSchema = v.pipe(
      v.string(),
      v.trim(),
      v.length(1),
      v.transform((val) => val.toUpperCase()),
      basicEnum,
      v.metadata({ ref: "key" })
    );

    const schema = v.record(complexSchema, v.string());

    const expected: Schema = {
      type: "object",
      properties: {
        A: {
          type: "string",
        },
        B: {
          type: "string",
        },
      },
      additionalProperties: false,
    };

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("supports registering key schemas in 3.1.0", () => {
    const expected: Schema3_1 = {
      type: "object",
      propertyNames: {
        $ref: "#/components/schemas/key",
      },
      additionalProperties: {
        type: "string",
      },
    };

    const complexSchema = v.pipe(
      v.string(),
      v.regex(/^foo/),
      v.metadata({ ref: "key" })
    );

    const schema = v.record(complexSchema, v.string());

    const result = createSchema(schema, { version: "3.1.0" });

    expect(result.schema).toStrictEqual(expected);
  });

  it("supports lazy key schemas in 3.1.0", () => {
    const expected: Schema3_1 = {
      type: "object",
      propertyNames: {
        $ref: "#/components/schemas/key",
      },
      additionalProperties: {
        type: "string",
      },
    };

    const complexSchema = v.pipe(
      v.string(),
      v.regex(/^foo/),
      v.metadata({ ref: "key" })
    );

    const schema = v.record(complexSchema, v.string());

    const result = createSchema(schema, { version: "3.1.0" });

    expect(result.schema).toStrictEqual(expected);
  });
});
