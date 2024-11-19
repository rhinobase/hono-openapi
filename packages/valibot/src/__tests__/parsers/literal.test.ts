import * as v from "valibot";
import { createSchema } from "valibot-openapi";
import type { Schema, Schema3_1 } from "../types";

describe("Create literal schema", () => {
  describe("OpenAPI 3.1.0", () => {
    it("creates a string const schema", () => {
      const expected: Schema3_1 = {
        type: "string",
        const: "a",
      };

      const schema = v.literal("a");

      const result = createSchema(schema, { version: "3.1.0" });

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates a number const schema", () => {
      const expected: Schema3_1 = {
        type: "number",
        const: 2,
      };

      const schema = v.literal(2);

      const result = createSchema(schema, { version: "3.1.0" });

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates a boolean const schema", () => {
      const expected: Schema3_1 = {
        type: "boolean",
        const: true,
      };

      const schema = v.literal(true);

      const result = createSchema(schema, { version: "3.1.0" });

      expect(result.schema).toStrictEqual(expected);
    });
  });

  describe("OpenAPI 3.0.0", () => {
    it("creates a string enum schema", () => {
      const expected: Schema = {
        type: "string",
        enum: ["a"],
      };

      const schema = v.literal("a");

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates a number enum schema", () => {
      const expected: Schema = {
        type: "number",
        enum: [2],
      };

      const schema = v.literal(2);

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates a boolean enum schema", () => {
      const expected: Schema = {
        type: "boolean",
        enum: [true],
      };

      const schema = v.literal(true);

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });
  });
});
