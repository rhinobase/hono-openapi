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

  it.skip("creates a number schema with lt or gt", () => {
    const expected: Schema = {
      type: "number",
      // @ts-expect-error
      exclusiveMinimum: 0,
      // @ts-expect-error
      exclusiveMaximum: 10,
    };

    // const schema = z.number().lt(10).gt(0);
    const schema = v.number();

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it.skip("creates a number schema with lte or gte", () => {
    const expected: Schema = {
      type: "number",
      minimum: 0,
      maximum: 10,
    };

    // const schema = z.number().lte(10).gte(0);
    const schema = v.number();

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it.skip("creates a number schema with lte or gte in openapi 3.0.0", () => {
    const expected: Schema = {
      type: "number",
      minimum: 0,
      maximum: 10,
    };

    // const schema = z.number().lte(10).gte(0);
    const schema = v.number();

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it.skip("creates a number schema with lt or gt in openapi 3.0.0", () => {
    const expected: Schema = {
      type: "number",
      minimum: 0,
      exclusiveMinimum: true,
      maximum: 10,
      exclusiveMaximum: true,
    };

    // const schema = z.number().lt(10).gt(0);
    const schema = v.number();

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
