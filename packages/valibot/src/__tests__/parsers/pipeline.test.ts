import type { Schema } from "../types";
import { createSchema } from "../../index";
import * as v from "valibot";

describe("createPipelineSchema", () => {
  describe("input", () => {
    it("creates a schema from a simple pipeline", () => {
      const schema = v.string();

      const expected: Schema = {
        type: "string",
      };

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates a schema from a transform pipeline", () => {
      const schema = v.pipe(
        v.string(),
        v.transform((arg) => arg.length)
      );

      const expected: Schema = {
        type: "string",
      };

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("overrides the input type from a transform pipeline with a custom effectType", () => {
      const schema = v.pipe(
        v.string(),
        v.transform((arg) => arg.length),
        v.metadata({ effectType: "output" })
      );

      const expected: Schema = {
        type: "number",
      };

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("renders the input schema if the effectType is same", () => {
      const schema = v.pipe(v.string(), v.metadata({ effectType: "same" }));

      const expected: Schema = {
        type: "string",
      };

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });
  });

  describe("output", () => {
    it("creates a schema from a simple pipeline", () => {
      const schema = v.string();
      const expected: Schema = {
        type: "string",
      };

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates a schema from a transform pipeline", () => {
      const schema = v.pipe(
        v.string(),
        v.transform((arg) => arg.length)
      );

      const expected: Schema = {
        type: "number",
      };

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("overrides the input type from a transform pipeline with a custom effectType", () => {
      const schema = v.pipe(
        v.string(),
        v.transform((val) => Number(val)),
        v.metadata({ effectType: "input" })
      );

      const expected: Schema = {
        type: "string",
      };

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("renders the input schema if the effectType is same", () => {
      const schema = v.pipe(v.string(), v.metadata({ effectType: "same" }));

      const expected: Schema = {
        type: "string",
      };

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });
  });
});
