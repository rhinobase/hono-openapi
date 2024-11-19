import * as v from "valibot";
import { createSchema } from "../../index";
import type { Schema } from "../types";

describe("Create custom schema", () => {
  it("returns a schema when creating an output schema with preprocess", () => {
    const expected: Schema = {
      type: "string",
    };
    const schema = v.pipe(
      v.string(),
      v.custom((check) => typeof check === "string")
    );

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
