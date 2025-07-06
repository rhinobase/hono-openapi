import { Hono } from "hono";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";
import { defineCommonTestRouteSpec } from "./utils/route.js";

describe("valibot", () => {
  it("basic", async () => {
    const app = new Hono().get(
      "/:id",
      describeRoute(
        defineCommonTestRouteSpec(resolver(v.object({ message: v.string() }))),
      ),
      validator("param", v.object({ id: v.string() })),
      validator(
        "query",
        v.object({ category: v.optional(v.picklist(["one", "two", "three"])) }),
      ),
      validator("json", v.object({ message: v.string() })),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });
});
