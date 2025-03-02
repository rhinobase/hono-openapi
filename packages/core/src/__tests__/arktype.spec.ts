import { type } from "arktype";
import { resolver } from "../arktype";

describe("arktype test", () => {
  it("should resolve schema", async () => {
    const result = await resolver(
      type({
        name: "string",
        age: "number",
      }),
    ).builder();
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
