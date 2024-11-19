import * as v from "valibot";
import { createSchema } from "../../index";
import type { Schema } from "../types";

describe("Create boolean schema", () => {
  it("creates a boolean schema", () => {
    const expected: Schema = {
      type: "boolean",
    };
    const schema = v.boolean();

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
