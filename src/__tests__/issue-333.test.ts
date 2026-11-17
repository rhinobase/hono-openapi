import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { validator } from "../middlewares.js";

const specsFor = (schema: z.ZodType) =>
  generateSpecs(
    new Hono().get("/pets", validator("query", schema), (c) => c.json([])),
  );

describe("a named query schema whose name has `/` or `~`", () => {
  it.each([
    ["`/`", "pets/Tag", "pets~1Tag"],
    ["`~`", "Pet~Tag", "Pet~0Tag"],
    ["a literal `~1`", "Pet~1Tag", "Pet~01Tag"],
  ])("refers to its single parameter, escaping %s", async (_, name, token) => {
    const specs = await specsFor(
      z.object({ tag: z.string() }).meta({ id: name }),
    );

    expect(specs.paths["/pets"]?.get?.parameters).toEqual([
      { $ref: `#/components/parameters/${token}` },
    ]);
    expect(specs.components?.parameters?.[name]).toEqual({
      in: "query",
      name: "tag",
      required: true,
      schema: { type: "string" },
    });
  });

  it("lists its parameters when it has more than one", async () => {
    const specs = await specsFor(
      z
        .object({ limit: z.number(), tag: z.string() })
        .meta({ id: "pets/Filter" }),
    );

    expect(
      specs.paths["/pets"]?.get?.parameters?.map(
        (parameter) => "name" in parameter && parameter.name,
      ),
    ).toEqual(["limit", "tag"]);
  });
});
