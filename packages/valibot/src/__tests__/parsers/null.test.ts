import type { Schema3_1 } from "../types";
import { createSchema } from "../../index";
import * as v from "valibot";

describe("createNullSchema", () => {
  it("creates a null schema", () => {
    const expected: Schema3_1 = {
      type: "null",
    };

    const schema = v.object({
      type: v.nullable(v.string()),
    });

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
