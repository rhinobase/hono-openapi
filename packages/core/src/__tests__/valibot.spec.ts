import * as v from "valibot";
import { resolver } from "../valibot";

describe("valibot test", () => {
  it("should resolve schema", async () => {
    const result = await resolver(
      v.object({
        name: v.string(),
        age: v.number(),
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

  it("should resolve schema with pipe and transform", async () => {
    const result = await resolver(
      v.object({
        id: v.pipe(
          v.string(),
          v.transform((value) => Number.parseInt(value, 10)),
        ),
      }),
      { errorMode: "ignore" },
    ).builder();
    expect(result).toEqual({
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
    });
  });
});
