import * as v from "valibot";
import { createSchema } from "../../index";
import type { Schema } from "../types";

describe("Create set schema", () => {
  it("creates simple arrays", () => {
    const expected: Schema = {
      type: "array",
      items: {
        type: "string",
      },
      uniqueItems: true,
    };

    const schema = v.set(v.string());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates min and max", () => {
    const expected: Schema = {
      type: "array",
      uniqueItems: true,
      items: {
        type: "string",
      },
      minItems: 0,
      maxItems: 10,
    };
    const schema = v.set(v.pipe(v.string(), v.minLength(0), v.maxLength(10)));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
