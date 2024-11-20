import * as v from "valibot";
import { createSchema } from "../../index";
import type { Schema } from "../types";

describe("Create branded schema", () => {
  it("supports branded schema", () => {
    const expected: Schema = {
      type: "object",
      properties: {
        name: {
          type: "string",
        },
      },
      required: ["name"],
    };

    const schema = v.pipe(v.object({ name: v.string() }), v.brand("Cat"));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
