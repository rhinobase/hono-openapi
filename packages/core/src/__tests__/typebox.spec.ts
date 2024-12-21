import { Type } from "@sinclair/typebox";
import { resolver } from "../typebox";

const simple = Type.Object({
  name: Type.String(),
  age: Type.Number(),
});

describe("typebox test", () => {
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
