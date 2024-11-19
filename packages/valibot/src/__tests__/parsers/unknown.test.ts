import * as v from "valibot";
import { createSchema } from "../../index";
import type { Schema } from "../types";

describe("Create unknown schema", () => {
  it("should create an empty schema for unknown", () => {
    const expected: Schema = {};

    const schema = v.unknown();

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("should create an empty schema for any", () => {
    const expected: Schema = {};

    const schema = v.any();

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
