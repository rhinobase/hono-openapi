import * as v from "valibot";
import { createSchema } from "../../index";
import type { Schema } from "../types";

describe("Create manual type schema", () => {
  it.skip("creates a simple string schema for an optional string", () => {
    const expected: Schema = {
      type: "string",
    };

    const schema = v.pipe(v.unknown(), v.metadata({ type: "string" }));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
