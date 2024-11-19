import * as v from "valibot";
import { createSchema } from "../../index";
import type { Schema } from "../types";

describe("Create default schema", () => {
  it("creates a default string schema", () => {
    const expected: Schema = {
      type: "string",
      default: "a",
    };

    const schema = v.optional(v.string(), "a");

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it.skip("adds a default property to a registered schema", () => {
    const expected: Schema = {
      allOf: [
        {
          $ref: "#/components/schemas/ref",
        },
      ],
      default: "a",
    };

    const schema = v.optional(
      v.pipe(v.string(), v.metadata({ ref: "ref" })),
      "a"
    );

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
