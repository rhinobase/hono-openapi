import * as v from "valibot";
import { createSchema } from "../../index";
import type { Schema } from "../types";

describe("Create array schema", () => {
  it("creates simple arrays", () => {
    const expected: Schema = {
      type: "array",
      items: {
        type: "string",
      },
    };
    const schema = v.array(v.string());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates min and max", () => {
    const expected: Schema = {
      type: "array",
      items: {
        type: "string",
      },
      minItems: 0,
      maxItems: 10,
    };

    const schema = v.pipe(v.array(v.string()), v.minLength(0), v.maxLength(10));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates exact length", () => {
    const expected: Schema = {
      type: "array",
      items: {
        type: "string",
      },
      minItems: 10,
      maxItems: 10,
    };

    const schema = v.pipe(v.array(v.string()), v.length(10));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
