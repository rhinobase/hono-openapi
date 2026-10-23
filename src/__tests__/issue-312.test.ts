import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { generateSpecs } from "../handler.js";
import { describeRoute } from "../middlewares.js";

describe("operation extensions", () => {
  it("writes an `x-` key given to `describeRoute` to the operation", async () => {
    const app = new Hono().get(
      "/pets",
      describeRoute({ "x-internal": true, summary: "List pets" }),
      (c) => c.json([]),
    );

    const specs = await generateSpecs(app);

    expect(specs.paths["/pets"]?.get?.["x-internal"]).toBe(true);
  });
});
