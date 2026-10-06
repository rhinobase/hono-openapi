import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";
import type { DescribeRouteOptions } from "../types.js";

const json = (schema: z.ZodType): DescribeRouteOptions["responses"] => ({
  200: {
    description: "OK",
    content: { "application/json": { schema: resolver(schema) } },
  },
});

const VisibleChild = z
  .object({ name: z.string() })
  .meta({ ref: "VisibleChild" });
const Visible = z
  .object({ id: z.string(), child: VisibleChild })
  .meta({ ref: "Visible" });
const Nested = z.object({ value: z.string() }).meta({ ref: "Nested" });
const Hidden = z
  .object({ secret: z.string(), nested: Nested })
  .meta({ ref: "Hidden" });
const Excluded = z.object({ internal: z.string() }).meta({ ref: "Excluded" });
const Shared = z.object({ name: z.string() }).meta({ ref: "Shared" });
const MiddlewareError = z
  .object({ error: z.string() })
  .meta({ ref: "MiddlewareError" });

const middleware = () =>
  describeRoute({
    responses: {
      500: {
        description: "Error",
        content: {
          "application/json": { schema: resolver(MiddlewareError) },
        },
      },
    },
  });

const schemaNames = (specs: Awaited<ReturnType<typeof generateSpecs>>) =>
  Object.keys(specs.components?.schemas ?? {}).sort();

describe("issue-253", () => {
  it("does not publish the schemas of a route hidden with `hide: true`", async () => {
    const app = new Hono()
      .get("/visible", describeRoute({ responses: json(Visible) }), (c) =>
        c.json({ id: "1" }),
      )
      .get(
        "/hidden",
        describeRoute({ hide: true, responses: json(Hidden) }),
        (c) => c.json({ secret: "s", nested: { value: "v" } }),
      );

    const specs = await generateSpecs(app);

    expect(Object.keys(specs.paths)).toEqual(["/visible"]);
    // `Nested` is only reachable through `Hidden`, so it goes too.
    expect(schemaNames(specs)).toEqual(["Visible", "VisibleChild"]);
  });

  it("does not publish the schemas of a route hidden with a function", async () => {
    const app = new Hono()
      .get("/visible", describeRoute({ responses: json(Visible) }), (c) =>
        c.json({ id: "1" }),
      )
      .get(
        "/hidden",
        describeRoute({ hide: () => true, responses: json(Hidden) }),
        (c) => c.json({ secret: "s", nested: { value: "v" } }),
      );

    const specs = await generateSpecs(app);

    expect(schemaNames(specs)).toEqual(["Visible", "VisibleChild"]);
  });

  it("does not publish the schemas of a route removed with `exclude`", async () => {
    const app = new Hono()
      .get("/visible", describeRoute({ responses: json(Visible) }), (c) =>
        c.json({ id: "1" }),
      )
      .get("/excluded", describeRoute({ responses: json(Excluded) }), (c) =>
        c.json({ internal: "i" }),
      );

    const specs = await generateSpecs(app, { exclude: ["/excluded"] });

    expect(Object.keys(specs.paths)).toEqual(["/visible"]);
    expect(schemaNames(specs)).toEqual(["Visible", "VisibleChild"]);
  });

  it("keeps a schema that a hidden and a documented route share", async () => {
    const app = new Hono()
      .get("/shared", describeRoute({ responses: json(Shared) }), (c) =>
        c.json({ name: "n" }),
      )
      .get(
        "/hidden",
        describeRoute({ hide: true, responses: json(Shared) }),
        (c) => c.json({ name: "n" }),
      );

    const specs = await generateSpecs(app);

    expect(schemaNames(specs)).toEqual(["Shared"]);
  });

  it("keeps components the documentation supplies, and the ones it refers to", async () => {
    const app = new Hono().get(
      "/hidden",
      describeRoute({ hide: true, responses: json(Hidden) }),
      (c) => c.json({ secret: "s", nested: { value: "v" } }),
    );

    const specs = await generateSpecs(app, {
      documentation: {
        components: {
          schemas: {
            Manual: {
              type: "object",
              properties: { nested: { $ref: "#/components/schemas/Nested" } },
            },
          },
        },
      },
    });

    // `Manual` is the documentation's own; `Nested` is kept because it
    // refers to it, while `Hidden` is not referred to by anything.
    expect(schemaNames(specs)).toEqual(["Manual", "Nested"]);
  });
  it("does not publish the schemas of middleware that only applies to hidden routes", async () => {
    const app = new Hono()
      .use("/admin/*", middleware())
      .get("/admin/secret", describeRoute({ hide: true }), (c) => c.json({}))
      .get("/visible", describeRoute({ responses: json(Visible) }), (c) =>
        c.json({ id: "1" }),
      );

    const specs = await generateSpecs(app);

    expect(Object.keys(specs.paths)).toEqual(["/visible"]);
    expect(schemaNames(specs)).toEqual(["Visible", "VisibleChild"]);
  });

  it("keeps the schemas of middleware that applies to a documented route", async () => {
    const app = new Hono()
      .use("/admin/*", middleware())
      .get("/admin/secret", describeRoute({ hide: true }), (c) => c.json({}))
      .get("/admin/report", describeRoute({ responses: json(Visible) }), (c) =>
        c.json({ id: "1" }),
      );

    const specs = await generateSpecs(app);

    expect(Object.keys(specs.paths)).toEqual(["/admin/report"]);
    expect(schemaNames(specs)).toEqual([
      "MiddlewareError",
      "Visible",
      "VisibleChild",
    ]);
  });

  it("does not publish the schemas of middleware registered after the routes it covers", async () => {
    const app = new Hono()
      .get("/admin/report", describeRoute({ responses: json(Visible) }), (c) =>
        c.json({ id: "1" }),
      )
      .use("/admin/*", middleware());

    const specs = await generateSpecs(app);

    // Middleware only adds to the operations registered after it.
    expect(schemaNames(specs)).toEqual(["Visible", "VisibleChild"]);
  });
  it("keeps the schemas of a documented route that validates its input", async () => {
    const Input = z.object({ name: z.string() }).meta({ ref: "Input" });

    const app = new Hono()
      .post(
        "/visible",
        describeRoute({ responses: json(Visible) }),
        validator("json", Input),
        (c) => c.json({ id: "1" }),
      )
      .get(
        "/hidden",
        describeRoute({ hide: true, responses: json(Hidden) }),
        (c) => c.json({ secret: "s", nested: { value: "v" } }),
      );

    const specs = await generateSpecs(app);

    // The validator adds a 400 response to the operation, which must not
    // lose track of the components the route brought in.
    expect(specs.paths["/visible"]?.post?.responses?.["400"]).toBeDefined();
    expect(schemaNames(specs)).toEqual(["Input", "Visible", "VisibleChild"]);
  });
  it("keeps a recursive pair of schemas that only the documentation refers to", async () => {
    const Child = z
      .object({
        name: z.string(),
        get parent() {
          return Parent.optional();
        },
      })
      .meta({ ref: "Child" });
    const Parent = z
      .object({
        name: z.string(),
        get children() {
          return z.array(Child);
        },
      })
      .meta({ ref: "Parent" });

    const app = new Hono()
      .get(
        "/tree",
        describeRoute({ hide: true, responses: json(Parent) }),
        (c) => c.json({ name: "root", children: [] }),
      )
      .get(
        "/hidden",
        describeRoute({ hide: true, responses: json(Hidden) }),
        (c) => c.json({ secret: "s", nested: { value: "v" } }),
      );

    const specs = await generateSpecs(app, {
      documentation: {
        components: {
          schemas: {
            Manual: {
              type: "object",
              properties: { tree: { $ref: "#/components/schemas/Parent" } },
            },
          },
        },
      },
    });

    // Following `Parent` leads to `Child` and back, which must neither loop
    // nor stop before `Child`.
    expect(schemaNames(specs)).toEqual(["Child", "Manual", "Parent"]);
  });

  it("gives the same document on repeated and concurrent generation", async () => {
    const Input = z.object({ name: z.string() }).meta({ ref: "Input" });

    const app = new Hono()
      .use("/admin/*", middleware())
      .get("/admin/report", describeRoute({ responses: json(Visible) }), (c) =>
        c.json({ id: "1" }),
      )
      .post(
        "/items",
        describeRoute({ responses: json(Visible) }),
        validator("json", Input),
        (c) => c.json({ id: "1" }),
      )
      .get(
        "/hidden",
        describeRoute({ hide: true, responses: json(Hidden) }),
        (c) => c.json({ secret: "s", nested: { value: "v" } }),
      );

    const first = await generateSpecs(app);
    const others = [
      await generateSpecs(app),
      ...(await Promise.all([
        generateSpecs(app),
        generateSpecs(app),
        generateSpecs(app),
      ])),
    ];

    // Each generation tracks the components of its own operations, so
    // generating again, or several times at once, gives the same document.
    others.forEach((specs) => {
      expect(specs).toEqual(first);
    });
    expect(schemaNames(first)).toEqual([
      "Input",
      "MiddlewareError",
      "Visible",
      "VisibleChild",
    ]);
  });
});
