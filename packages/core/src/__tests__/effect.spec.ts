import { Schema } from "effect";
import { resolver } from "../effect";

const simple = Schema.Struct({
  name: Schema.String,
  age: Schema.Number,
});

describe("effect test", () => {
  it("should resolve schema", async () => {
    const result = await resolver(simple).builder();
    expect(result).toEqual({
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name", "age"],
      },
    });
  });
});
