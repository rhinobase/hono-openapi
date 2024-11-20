import * as v from "valibot";
import { createSchema } from "../../index";
import type { Schema } from "../types";

describe("Create enum schema", () => {
  it("creates a string enum schema", () => {
    const expected: Schema = {
      type: "string",
      enum: ["a", "b"],
    };

    const schema = v.picklist(["a", "b"]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
