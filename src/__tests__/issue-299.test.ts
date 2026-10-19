import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver } from "../middlewares.js";
import type { DescribeRouteOptions } from "../types.js";

const json = (schema: z.ZodType): DescribeRouteOptions["responses"] => ({
  200: {
    description: "OK",
    content: { "application/json": { schema: resolver(schema) } },
  },
});

const Pet = z.object({ name: z.string() }).meta({ ref: "Pet" });
const Note = z.object({ text: z.string() }).meta({ ref: "Note" });
const Audit = z.object({ actor: z.string() }).meta({ ref: "Audit" });

const app = new Hono()
  .get("/pets", describeRoute({ responses: json(Pet) }), (c) =>
    c.json({ name: "Rex" }),
  )
  .get("/notes", describeRoute({ hide: true, responses: json(Note) }), (c) =>
    c.json({ text: "Hi" }),
  )
  .get(
    "/audit",
    describeRoute({
      hide: ({ path }) => path.startsWith("/audit"),
      responses: json(Audit),
    }),
    (c) => c.json({ actor: "admin" }),
  );

describe("includeHiddenRoutes", () => {
  it("documents hidden routes, with their components, when set", async () => {
    const specs = await generateSpecs(app, { includeHiddenRoutes: true });

    expect(Object.keys(specs.paths).sort()).toEqual([
      "/audit",
      "/notes",
      "/pets",
    ]);
    expect(Object.keys(specs.components?.schemas ?? {}).sort()).toEqual([
      "Audit",
      "Note",
      "Pet",
    ]);
  });

  it("still hides them by default", async () => {
    const specs = await generateSpecs(app);

    expect(Object.keys(specs.paths)).toEqual(["/pets"]);
    expect(Object.keys(specs.components?.schemas ?? {})).toEqual(["Pet"]);
  });

  it("leaves `hide` out of the documented operations", async () => {
    const visible = new Hono().get(
      "/pets",
      describeRoute({ hide: false, responses: json(Pet) }),
      (c) => c.json({ name: "Rex" }),
    );

    const specs = await generateSpecs(visible);
    const included = await generateSpecs(app, { includeHiddenRoutes: true });

    expect(specs.paths["/pets"]?.get).not.toHaveProperty("hide");
    expect(included.paths["/notes"]?.get).not.toHaveProperty("hide");
    expect(included.paths["/audit"]?.get).not.toHaveProperty("hide");
  });
});
