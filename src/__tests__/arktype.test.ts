import { type } from "arktype";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";
import { defineCommonTestRouteSpec } from "./utils/route.js";

describe("arktype", () => {
  it("basic", async () => {
    const app = new Hono().get(
      "/:id",
      describeRoute(
        defineCommonTestRouteSpec(
          resolver(
            type({
              message: "string",
            }),
          ),
        ),
      ),
      validator("param", type({ id: "string" })),
      validator("json", type({ message: "string" })),
      validator('query', type({ "category?": "'one' | 'two' | 'three'" })),
      async (c) => {
        return c.json({ message: "Hello, world!" });
      },
    );

    const specs = await generateSpecs(app);

    expect(specs).toMatchSnapshot();
  });
});
