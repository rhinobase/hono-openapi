import * as v from "valibot";
import { createSchema } from "valibot-openapi";
import type { Schema } from "../types";

describe("Create readonly schema", () => {
  it("creates a simple string schema for a readonly string", () => {
    const expected: Schema = {
      type: "string",
    };

    const schema = v.pipe(v.string(), v.readonly());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
