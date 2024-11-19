import * as v from "valibot";
import { createSchema } from "../../index";
import type { Schema } from "../types";

describe("Create number schema", () => {
  it("creates a simple number schema", () => {
    const expected: Schema = {
      type: "number",
    };
    const schema = v.number();

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a integer schema", () => {
    const expected: Schema = {
      type: "integer",
    };
    const schema = v.pipe(v.number(), v.integer());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a number schema with minValue or maxValue", () => {
    const expected: Schema = {
      type: "number",
      minimum: 0,
      maximum: 10,
    };

    const schema = v.pipe(v.number(), v.minValue(0), v.maxValue(10));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("supports multipleOf", () => {
    const expected: Schema = {
      type: "number",
      multipleOf: 2,
    };
    const schema = v.pipe(v.number(), v.multipleOf(2));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
