import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { resolver } from "../index";

describe("effect test", () => {
  it("should resolve schema", async () => {
    const result = await resolver(
      Schema.Struct({
        name: Schema.String,
        age: Schema.Number,
      }),
    ).builder();
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
