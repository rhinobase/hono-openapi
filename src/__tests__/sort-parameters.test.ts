import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, validator } from "../middlewares.js";

const names = (parameters: unknown) =>
  (parameters as { $ref?: string; in?: string; name?: string }[]).map(
    (parameter) => parameter.$ref ?? `${parameter.in}:${parameter.name}`,
  );

const petQuery = z.object({
  tag: z.string(),
  limit: z.number(),
  after: z.string(),
});

describe("sortParameters", () => {
  it("keeps the order of the schema by default", async () => {
    const app = new Hono().get("/pets", validator("query", petQuery), (c) =>
      c.json([]),
    );

    const specs = await generateSpecs(app);

    expect(names(specs.paths["/pets"]?.get?.parameters)).toEqual([
      "query:tag",
      "query:limit",
      "query:after",
    ]);
  });

  it("sorts query parameters by name", async () => {
    const app = new Hono().get("/pets", validator("query", petQuery), (c) =>
      c.json([]),
    );

    const specs = await generateSpecs(app, { sortParameters: true });

    expect(names(specs.paths["/pets"]?.get?.parameters)).toEqual([
      "query:after",
      "query:limit",
      "query:tag",
    ]);
  });

  it("gives a schema the same order however it was put together", async () => {
    const shared = z.object({ tag: z.string(), after: z.string() });
    const app = new Hono()
      .get(
        "/pets",
        validator("query", shared.extend({ limit: z.number() })),
        (c) => c.json([]),
      )
      .get(
        "/notes",
        validator(
          "query",
          z.object({ limit: z.number() }).extend(shared.shape),
        ),
        (c) => c.json([]),
      );

    const specs = await generateSpecs(app, { sortParameters: true });

    expect(names(specs.paths["/pets"]?.get?.parameters)).toEqual(
      names(specs.paths["/notes"]?.get?.parameters),
    );
  });

  it("keeps path parameters in the order the path names them", async () => {
    const app = new Hono().get(
      "/shelters/:shelterId/pets/:petId",
      validator(
        "param",
        z.object({ petId: z.string(), shelterId: z.string() }),
      ),
      (c) => c.json({}),
    );

    const specs = await generateSpecs(app, { sortParameters: true });

    expect(
      names(specs.paths["/shelters/{shelterId}/pets/{petId}"]?.get?.parameters),
    ).toEqual(["path:shelterId", "path:petId"]);
  });

  it("orders parameters from several middleware by location, then name", async () => {
    const app = new Hono().get(
      "/shelters/:shelterId/pets",
      validator(
        "cookie",
        z.object({ session: z.string(), locale: z.string() }),
      ),
      describeRoute({
        parameters: [{ in: "query", name: "zone", schema: { type: "string" } }],
      }),
      validator(
        "header",
        z.object({ "x-trace": z.string(), accept: z.string() }),
      ),
      validator("query", z.object({ tag: z.string(), after: z.string() })),
      (c) => c.json([]),
    );

    const specs = await generateSpecs(app, { sortParameters: true });

    expect(
      names(specs.paths["/shelters/{shelterId}/pets"]?.get?.parameters),
    ).toEqual([
      "path:shelterId",
      "query:after",
      "query:tag",
      "query:zone",
      "header:accept",
      "header:x-trace",
      "cookie:locale",
      "cookie:session",
    ]);
  });

  it("sorts a reference to a parameter component by the parameter it names", async () => {
    const app = new Hono().get(
      "/pets",
      validator("query", z.object({ tag: z.string() }).meta({ id: "Tag" })),
      validator("query", z.object({ after: z.string(), zone: z.string() })),
      (c) => c.json([]),
    );

    const specs = await generateSpecs(app, { sortParameters: true });

    expect(names(specs.paths["/pets"]?.get?.parameters)).toEqual([
      "query:after",
      "#/components/parameters/Tag",
      "query:zone",
    ]);
  });

  it("puts a reference it can't resolve after the others", async () => {
    const app = new Hono().get(
      "/pets",
      describeRoute({
        parameters: [{ $ref: "#/components/parameters/Elsewhere" }],
      }),
      validator("query", z.object({ tag: z.string(), after: z.string() })),
      (c) => c.json([]),
    );

    const specs = await generateSpecs(app, { sortParameters: true });

    expect(names(specs.paths["/pets"]?.get?.parameters)).toEqual([
      "query:after",
      "query:tag",
      "#/components/parameters/Elsewhere",
    ]);
  });
});
