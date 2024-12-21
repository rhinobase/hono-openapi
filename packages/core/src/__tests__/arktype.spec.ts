import { type } from "arktype";
import { resolver } from "../arktype";

const simple = type({
  name: "string",
  age: "number",
});

describe("arktype test", () => {
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
