import { type } from "arktype";
import { describe, expect, it } from "vitest";
import { resolver } from "../index";

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
