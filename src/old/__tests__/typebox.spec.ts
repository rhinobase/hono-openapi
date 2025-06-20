import { Type } from "@sinclair/typebox";
import { resolver } from "../typebox";
import { jsonify } from "./utils";

describe("typebox test", () => {
  it("should resolve schema", async () => {
    const result = jsonify(
      await resolver(
        Type.Object({
          name: Type.String(),
          age: Type.Number(),
        }),
      ).builder(),
    );
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
