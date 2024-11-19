import * as v from "valibot";
import { createSchema } from "../../index";
import type { Schema, Schema3_1 } from "../types";

describe("Create string schema", () => {
  it("creates a simple string schema", () => {
    const expected: Schema = {
      type: "string",
    };

    const schema = v.string();

    const result = createSchema(schema);

    expect(result.schema).toEqual(expected);
  });

  it("creates a string schema with a regex pattern", () => {
    const expected: Schema = {
      type: "string",
      pattern: "^hello",
    };

    const schema = v.pipe(v.string(), v.regex(/^hello/));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a string schema with a startsWith pattern", () => {
    const expected: Schema = {
      type: "string",
      pattern: "^hello",
    };

    const schema = v.pipe(v.string(), v.startsWith("hello"));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a string schema with an endsWith pattern", () => {
    const expected: Schema = {
      type: "string",
      pattern: "hello$",
    };

    const schema = v.pipe(v.string(), v.endsWith("hello"));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a string schema with an includes pattern", () => {
    const expected: Schema = {
      type: "string",
      pattern: "hello",
    };
    const schema = v.pipe(v.string(), v.includes("hello"));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it.skip("creates a string schema with multiple patterns and length checks", () => {
    const expected: Schema = {
      allOf: [
        {
          type: "string",
          pattern: "^foo",
          minLength: 10,
        },
        {
          type: "string",
          pattern: "foo$",
        },
        {
          type: "string",
          pattern: "^hello",
        },
        {
          type: "string",
          pattern: "hello",
        },
      ],
    };

    const schema = v.pipe(
      v.string(),
      v.minLength(10),
      v.includes("hello"),
      v.startsWith("hello"),
      v.regex(/^foo/),
      v.regex(/foo$/)
    );

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a string schema with min and max", () => {
    const expected: Schema = {
      type: "string",
      minLength: 0,
      maxLength: 1,
    };
    const schema = v.pipe(v.string(), v.minLength(0), v.maxLength(1));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a string schema with nonempty", () => {
    const expected: Schema = {
      type: "string",
      minLength: 1,
    };

    const schema = v.pipe(v.string(), v.nonEmpty());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a string schema with a set length", () => {
    const expected: Schema = {
      type: "string",
      minLength: 1,
      maxLength: 1,
    };
    const schema = v.pipe(v.string(), v.length(1));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it.each`
    schema                                 | format
    ${v.pipe(v.string(), v.uuid())}        | ${"uuid"}
    ${v.pipe(v.string(), v.email())}       | ${"email"}
    ${v.pipe(v.string(), v.url())}         | ${"uri"}
    ${v.pipe(v.string(), v.isoDateTime())} | ${"date-time"}
    ${v.date()}                            | ${"date"}
    ${v.pipe(v.string(), v.isoTime())}     | ${"time"}
  `(
    "creates a string schema with $format",
    ({ schema, format }: { schema: v.GenericSchema; format: string }) => {
      const expected: Schema = {
        type: "string",
        format,
      };

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    }
  );

  it("supports contentEncoding in 3.1.0", () => {
    const expected: Schema3_1 = {
      type: "string",
      // @ts-ignore
      contentEncoding: "base64",
    };

    const schema = v.pipe(v.string(), v.base64());

    const result = createSchema(schema, { version: "3.1.0" });

    expect(result.schema).toStrictEqual(expected);
  });

  it("does not support contentEncoding in 3.0.0", () => {
    const expected: Schema = {
      type: "string",
    };

    const schema = v.pipe(v.string(), v.base64());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
