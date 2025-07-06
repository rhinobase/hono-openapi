import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";
import { defineCommonTestRouteSpec } from "./utils/route.js";

describe("zod v3", () => {
  it("basic", async () => {
    const app = new Hono().get(
      "/:id",
      describeRoute(
        defineCommonTestRouteSpec(
          resolver(
            z.object({
              message: z.string(),
            }),
          ),
        ),
      ),
      validator("param", z.object({ id: z.string() })),
      validator("json", z.object({ message: z.string() })),
      validator(
        "query",
        z.object({
          category: z.enum(["one", "two", "three"]).optional(),
        }),
      ),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });
});
