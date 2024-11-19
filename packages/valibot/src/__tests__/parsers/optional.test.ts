import * as v from "valibot";
import { createSchema } from "valibot-openapi";
import type { Schema } from "../types";

describe("Create optional schema", () => {
  it("creates a simple string schema for an optional string", () => {
    const expected: Schema = {
      type: "string",
    };
    const schema = v.optional(v.string());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
