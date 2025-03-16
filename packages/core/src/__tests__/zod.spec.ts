import { describe, expect, it } from "vitest";
import z from "zod";
import { resolver } from "../index";

describe("zod test", () => {
  it("should resolve schema", async () => {
    const result = await resolver(
      z.object({
        name: z.string(),
        age: z.number(),
      }),
    ).builder();
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
