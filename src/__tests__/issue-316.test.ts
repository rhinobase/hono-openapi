import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, validator } from "../middlewares.js";

describe("path context is inherited once per operation", () => {
  it.each([false, true])(
    "preserves an explicit route body requirement of %s over inherited metadata",
    async (required) => {
      const app = new Hono()
        .use(
          "/v1/*",
          describeRoute({
            requestBody: { required: !required, content: {} },
          }),
        )
        .post(
          "/v1/quotes",
          describeRoute({ requestBody: { required, content: {} } }),
          validator("json", z.object({ text: z.string() })),
          (c) => c.json({}, 201),
        );

      const specs = await generateSpecs(app);

      expect(specs.paths["/v1/quotes"]?.post?.requestBody).toMatchObject({
        required,
      });
    },
  );

  it("preserves the operation ID chosen by an earlier handler callback", async () => {
    let calls = 0;
    const app = new Hono()
      .use("/v1/*", describeRoute({ security: [{ bearerAuth: [] }] }))
      .get(
        "/v1/quotes",
        describeRoute({ operationId: () => `operation${++calls}` }),
        describeRoute({ summary: "List quotes" }),
        (c) => c.json([]),
      );

    const specs = await generateSpecs(app);

    expect(specs.paths["/v1/quotes"]?.get?.operationId).toBe("operation1");
    expect(calls).toBe(1);
  });

  it.each([false, true])(
    "inherits context registered between handlers with includeEmptyPaths=%s",
    async (includeEmptyPaths) => {
      const app = new Hono()
        .get("/v1/quotes", async (_, next) => next())
        .get("/v1/quotes", describeRoute({ summary: "List quotes" }))
        .use("/v1/*", describeRoute({ security: [{ bearerAuth: [] }] }))
        .get("/v1/quotes", describeRoute({ tags: ["Quotes"] }))
        .use("/v1/*", describeRoute({ security: [{ apiKey: [] }] }))
        .get("/v1/quotes", describeRoute({ description: "Quotes" }), (c) =>
          c.json([]),
        );

      const specs = await generateSpecs(app, { includeEmptyPaths });
      const operation = specs.paths["/v1/quotes"]?.get;

      expect(operation?.security).toEqual([{ bearerAuth: [] }, { apiKey: [] }]);
      expect(operation?.summary).toBe("List quotes");
      expect(operation?.tags).toEqual(["Quotes"]);
    },
  );

  it.each([1, 2, 3])(
    "does not repeat security with %i describeRoute handlers",
    async (count) => {
      const app = new Hono();
      app.use("/v1/*", describeRoute({ security: [{ bearerAuth: [] }] }));
      const handlers = Array.from({ length: count }, (_, i) =>
        describeRoute({ tags: [`t${i}`] }),
      );
      app.post("/v1/quotes", ...handlers, (c) => c.json({}, 201));

      const specs = await generateSpecs(app);

      expect(specs.paths["/v1/quotes"]?.post?.security).toEqual([
        { bearerAuth: [] },
      ]);
    },
  );

  it.each(["before", "after"])(
    "does not repeat security with a validator %s describeRoute",
    async (order) => {
      const app = new Hono();
      app.use("/v1/*", describeRoute({ security: [{ bearerAuth: [] }] }));
      const docs = describeRoute({ summary: "Create a quote" });
      const body = validator("json", z.object({ text: z.string() }));
      const handlers = order === "before" ? [body, docs] : [docs, body];
      app.post("/v1/quotes", ...handlers, (c) => c.json({}, 201));

      const specs = await generateSpecs(app);
      const operation = specs.paths["/v1/quotes"]?.post;

      expect(operation?.security).toEqual([{ bearerAuth: [] }]);
      expect(operation?.summary).toBe("Create a quote");
      expect(operation?.requestBody).toMatchObject({ required: true });
    },
  );

  it("preserves nested context and route security alternatives across generations", async () => {
    const app = new Hono()
      .use(describeRoute({ security: [{ bearerAuth: [] }] }))
      .use("/v1/*", describeRoute({ security: [{ apiKey: [] }] }))
      .post(
        "/v1/quotes",
        describeRoute({ security: [{ oauth: ["quotes:write"] }] }),
        describeRoute({ summary: "Create a quote" }),
        (c) => c.json({}, 201),
      )
      .get(
        "/v1/quotes",
        describeRoute({ summary: "List quotes" }),
        describeRoute({ tags: ["Quotes"] }),
        (c) => c.json([]),
      )
      .get("/health", describeRoute({}), (c) => c.json({ ok: true }));

    for (let i = 0; i < 2; i++) {
      const specs = await generateSpecs(app);

      expect(specs.paths["/v1/quotes"]?.post?.security).toEqual([
        { bearerAuth: [] },
        { apiKey: [] },
        { oauth: ["quotes:write"] },
      ]);
      expect(specs.paths["/v1/quotes"]?.get?.security).toEqual([
        { bearerAuth: [] },
        { apiKey: [] },
      ]);
      expect(specs.paths["/health"]?.get?.security).toEqual([
        { bearerAuth: [] },
      ]);
    }
  });

  it("inherits servers once and preserves route arrays and scalar overrides", async () => {
    const app = new Hono()
      .use(
        "/v1/*",
        describeRoute({
          summary: "Inherited summary",
          servers: [{ url: "https://api.example.com" }],
        }),
      )
      .get(
        "/v1/quotes",
        describeRoute({
          summary: "List quotes",
          servers: [{ url: "https://quotes.example.com" }],
          security: [{ oauth: ["quotes:read"] }],
        }),
        describeRoute({ security: [{ apiKey: [] }] }),
        (c) => c.json([]),
      );

    const specs = await generateSpecs(app);
    const operation = specs.paths["/v1/quotes"]?.get;

    expect(operation?.summary).toBe("List quotes");
    expect(operation?.servers).toEqual([
      { url: "https://api.example.com" },
      { url: "https://quotes.example.com" },
    ]);
    expect(operation?.security).toEqual([
      { oauth: ["quotes:read"] },
      { apiKey: [] },
    ]);
  });

  it("does not repeat context for undocumented handlers with includeEmptyPaths", async () => {
    const app = new Hono()
      .use("/v1/*", describeRoute({ security: [{ bearerAuth: [] }] }))
      .get(
        "/v1/quotes",
        async (_, next) => next(),
        describeRoute({ summary: "List quotes" }),
        (c) => c.json([]),
      );

    const specs = await generateSpecs(app, { includeEmptyPaths: true });

    expect(specs.paths["/v1/quotes"]?.get?.security).toEqual([
      { bearerAuth: [] },
    ]);
  });
});
