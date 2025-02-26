import * as v from "valibot";
import { resolver } from "../valibot";
import { jsonify } from "./utils";

const simple = v.object({
  name: v.string(),
  age: v.number(),
});

describe("valibot test", () => {
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
