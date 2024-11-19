import * as v from "valibot";
import { createSchema } from "../../index";
import type { Schema } from "../types";

describe("Create transform schema", () => {
  describe("input", () => {
    it("creates a schema from transform", () => {
      const schema = v.pipe(
        v.string(),
        v.transform((str) => str.length)
      );

      const expected: Schema = {
        type: "string",
      };

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("produces an effect which is of type input", () => {
      const schema = v.pipe(
        v.string(),
        v.transform((str) => str.length)
      );

      const expected: Schema = {
        type: "string",
      };

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("does not throw an error if the effectType is output and effectType is set in openapi", () => {
      const schema = v.pipe(
        v.string(),
        v.transform((str) => str.length),
        v.metadata({ effectType: "input" })
      );

      const expected: Schema = {
        type: "string",
      };

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("renders the input schema if the effectType is same", () => {
      const schema = v.pipe(
        v.string(),
        v.transform((str) => str),
        v.metadata({ effectType: "same" })
      );
      const expected: Schema = {
        type: "string",
      };

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });
  });

  describe("output", () => {
    it("throws an error with a schema with transform", () => {
      const schema = v.pipe(
        v.string(),
        v.transform((str) => str.length)
      );

      const result = createSchema(schema);

      expect(result.schema).toThrow("");
    });

    it("creates a schema with the manual type when a type is manually specified", () => {
      const expected: Schema = {
        type: "number",
      };
      const schema = v.pipe(
        v.string(),
        v.transform((str) => str.length),
        v.metadata({ type: "number" })
      );

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("returns a schema when creating a schema with transform when openapi effectType is set", () => {
      const schema = v.pipe(
        v.string(),
        v.transform((str) => str),
        v.metadata({ effectType: "input" })
      );

      const expected: Schema = {
        type: "string",
      };

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("does not change the state effectType when openapi effectType is set", () => {
      const schema = v.pipe(
        v.string(),
        v.transform((str) => str.length),
        v.metadata({ effectType: "input" })
      );

      const result = createSchema(schema);

      expect(result.schema).toBeUndefined();
    });

    it("renders the input schema if the effectType is same", () => {
      const schema = v.pipe(
        v.string(),
        v.transform((str) => str),
        v.metadata({ effectType: "same" })
      );

      const expected: Schema = {
        type: "string",
      };

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });
  });
});

describe("throwTransformError", () => {
  it("throws an transform error", () => {
    const schema = v.pipe(v.string(), v.metadata({ description: "a" }));

    const result = createSchema(schema);

    expect(result.schema).toThrowErrorMatchingInlineSnapshot("");
  });
});
