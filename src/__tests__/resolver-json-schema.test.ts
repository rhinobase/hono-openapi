import { describe, expect, it } from "vitest";
import { z as z3 } from "zod/v3";
import { z as z4 } from "zod/v4";
import { resolver } from "../middlewares.js";

const defaults = z4.object({
  pinned: z4.boolean().default(false),
  title: z4.string(),
});
const pipe = z3.object({ quantity: z3.string().pipe(z3.coerce.number()) });

describe("resolver.toJSONSchema compatibility", () => {
  it("describes Zod 4 output by default", async () => {
    expect(await resolver(defaults).toJSONSchema()).toMatchObject({
      additionalProperties: false,
      required: ["pinned", "title"],
    });
  });

  it("lets call-time Zod 4 io override creation options without mutating them", async () => {
    const creation = Object.freeze({ io: "output" });
    const custom = Object.freeze({ io: "input" });
    expect(
      await resolver(defaults, creation).toJSONSchema(custom),
    ).toMatchObject({
      required: ["title"],
    });
    expect(
      await resolver(defaults, custom).toJSONSchema(creation),
    ).toMatchObject({
      additionalProperties: false,
      required: ["pinned", "title"],
    });
    expect(await resolver(defaults, custom).toJSONSchema()).toMatchObject({
      required: ["title"],
    });
    expect(await resolver(defaults, custom).toJSONSchema()).toMatchObject({
      required: ["title"],
    });
    expect(creation).toEqual({ io: "output" });
    expect(custom).toEqual({ io: "input" });
  });

  it("keeps both sides of a Zod 3 pipe by default", async () => {
    expect(await resolver(pipe).toJSONSchema()).toMatchObject({
      properties: {
        quantity: { allOf: [{ type: "string" }, { type: "number" }] },
      },
    });
  });

  it.each([
    ["input", "string"],
    ["output", "number"],
  ])("honors an explicit Zod 3 io of %s", async (io, type) => {
    const expected = { properties: { quantity: { type } } };
    expect(await resolver(pipe, { io }).toJSONSchema()).toMatchObject(expected);
    expect(await resolver(pipe).toJSONSchema({ io })).toMatchObject(expected);
  });

  it.each([
    ["input", "output", { type: "string" }],
    ["output", "input", { type: "number" }],
    ["all", "output", { allOf: [{ type: "string" }, { type: "number" }] }],
  ])(
    "lets Zod 3 pipeStrategy %s win over io %s",
    async (pipeStrategy, io, quantity) => {
      expect(
        await resolver(pipe, { io }).toJSONSchema({ pipeStrategy }),
      ).toMatchObject({
        properties: { quantity },
      });
    },
  );
});
