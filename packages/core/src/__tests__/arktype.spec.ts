import { type } from "arktype";
import { resolver } from "../arktype";
import { jsonify } from "./utils";

const simple = type({
  name: "string",
  age: "number",
});

describe("arktype test", () => {
  it("should resolve schema", async () => {
    const result = jsonify(await resolver(simple).builder());
    expect(result).toEqual({
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["age", "name"],
      },
    });
  });
});
