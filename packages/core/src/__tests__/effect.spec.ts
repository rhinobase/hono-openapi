import { Schema } from "effect";
import { resolver } from "../effect";
import { jsonify } from "./utils";

const simple = Schema.Struct({
  name: Schema.String,
  age: Schema.Number,
});

describe("effect test", () => {
  it("should resolve schema", async () => {
    const result = jsonify(await resolver(simple).builder());
    expect(result).toEqual({
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name", "age"],
      },
    });
  });
});
