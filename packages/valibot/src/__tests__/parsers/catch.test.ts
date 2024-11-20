import * as v from "valibot";
import { createSchema } from "../../index";
import type { Schema } from "../types";

describe("Create catch schema", () => {
  it("creates a default string schema for a string with a catch", () => {
    const expected: Schema = {
      type: "string",
      default: "bob",
    };

    const schema = v.fallback(v.string(), "bob");

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
