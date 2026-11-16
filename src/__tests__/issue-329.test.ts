import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

const Pet = z.object({ name: z.string() });
const Note = z.object({ text: z.string() });

const PetProblem = z
  .object({ detail: z.string(), title: z.string() })
  .meta({ ref: "PetProblem" });
const NoteErrors = z.object({ errors: z.array(z.string()) });

const petProblem = {
  content: { "application/problem+json": { schema: resolver(PetProblem) } },
  description: "The pet is invalid",
};
const noteErrors = {
  content: { "application/json": { schema: resolver(NoteErrors) } },
  description: "The note is invalid",
};

const responses = async (app: Hono, options = {}) => {
  const specs = await generateSpecs(app, options);

  return Object.fromEntries(
    Object.entries(specs.paths).flatMap(([path, item]) =>
      Object.entries(item ?? {}).map(([method, operation]) => [
        `${method} ${path}`,
        operation.responses?.["400"],
      ]),
    ),
  );
};

describe("validationErrorResponse", () => {
  it("documents the 400 each validator sets on its own route", async () => {
    const app = new Hono()
      .post(
        "/pets",
        validator("json", Pet, undefined, {
          validationErrorResponse: petProblem,
        }),
        (c) => c.json({}),
      )
      .post(
        "/notes",
        validator("json", Note, undefined, {
          validationErrorResponse: noteErrors,
        }),
        (c) => c.json({}),
      );

    const specs = await generateSpecs(app);

    expect(specs.paths["/pets"]?.post?.responses?.["400"]).toEqual({
      content: {
        "application/problem+json": {
          schema: { $ref: "#/components/schemas/PetProblem" },
        },
      },
      description: "The pet is invalid",
    });
    expect(specs.paths["/notes"]?.post?.responses?.["400"]).toEqual({
      content: {
        "application/json": {
          schema: {
            additionalProperties: false,
            properties: {
              errors: { items: { type: "string" }, type: "array" },
            },
            required: ["errors"],
            type: "object",
          },
        },
      },
      description: "The note is invalid",
    });
    expect(specs.components?.schemas?.PetProblem).toEqual({
      additionalProperties: false,
      properties: { detail: { type: "string" }, title: { type: "string" } },
      required: ["detail", "title"],
      type: "object",
    });
  });

  it("documents no 400 when set to `false`", async () => {
    const app = new Hono().post(
      "/pets",
      validator("json", Pet, undefined, { validationErrorResponse: false }),
      (c) => c.json({}),
    );

    expect(await responses(app)).toEqual({ "post /pets": undefined });
  });

  it("keeps a reference as it is", async () => {
    const ref = { $ref: "#/components/responses/PetProblem" };
    const app = new Hono().post(
      "/pets",
      validator("json", Pet, undefined, { validationErrorResponse: ref }),
      (c) => c.json({}),
    );

    expect(await responses(app)).toEqual({ "post /pets": ref });
  });

  it("wins over `defaultValidationErrorResponse`", async () => {
    const app = new Hono()
      .post(
        "/pets",
        validator("json", Pet, undefined, {
          validationErrorResponse: noteErrors,
        }),
        (c) => c.json({}),
      )
      .post(
        "/notes",
        validator("json", Note, undefined, { validationErrorResponse: false }),
        (c) => c.json({}),
      );

    expect(
      await responses(app, {
        defaultValidationErrorResponse: { description: "Bad request" },
      }),
    ).toEqual({
      "post /notes": undefined,
      "post /pets": expect.objectContaining({
        description: "The note is invalid",
      }),
    });
    expect(
      await responses(app, { defaultValidationErrorResponse: false }),
    ).toEqual({
      "post /notes": undefined,
      "post /pets": expect.objectContaining({
        description: "The note is invalid",
      }),
    });
  });

  it("leaves a validator without it on `defaultValidationErrorResponse`", async () => {
    const app = new Hono().post("/pets", validator("json", Pet), (c) =>
      c.json({}),
    );

    expect(
      await responses(app, {
        defaultValidationErrorResponse: { description: "Bad request" },
      }),
    ).toEqual({ "post /pets": { description: "Bad request" } });
    expect(
      await responses(app, { defaultValidationErrorResponse: false }),
    ).toEqual({ "post /pets": undefined });
  });

  it("gives way to a 400 documented with `describeRoute`, before or after it", async () => {
    const described = describeRoute({
      responses: {
        200: { description: "OK" },
        400: { description: "Described" },
      },
    });
    const validated = validator("json", Pet, undefined, {
      validationErrorResponse: petProblem,
    });
    const app = new Hono()
      .post("/pets", described, validated, (c) => c.json({}))
      .post("/notes", validated, described, (c) => c.json({}));

    const specs = await generateSpecs(app);

    expect(specs.paths["/pets"]?.post?.responses?.["400"]).toEqual({
      description: "Described",
    });
    expect(specs.paths["/notes"]?.post?.responses?.["400"]).toEqual({
      description: "Described",
    });
  });

  it("documents the last one set when several validators of a route set one", async () => {
    const app = new Hono()
      .post(
        "/pets",
        validator(
          "query",
          z.object({ dryRun: z.string().optional() }),
          undefined,
          {
            validationErrorResponse: noteErrors,
          },
        ),
        validator("json", Pet, undefined, {
          validationErrorResponse: petProblem,
        }),
        validator("header", z.object({ "x-tenant": z.string() })),
        (c) => c.json({}),
      )
      .post(
        "/notes",
        validator(
          "query",
          z.object({ dryRun: z.string().optional() }),
          undefined,
          {
            validationErrorResponse: noteErrors,
          },
        ),
        validator("json", Note, undefined, { validationErrorResponse: false }),
        (c) => c.json({}),
      );

    expect(await responses(app)).toEqual({
      "post /notes": undefined,
      "post /pets": expect.objectContaining({
        description: "The pet is invalid",
      }),
    });
  });

  it("applies to the routes a validator registered with `use` runs for", async () => {
    const app = new Hono();
    app.use(
      "/pets/*",
      validator("header", z.object({ "x-tenant": z.string() }), undefined, {
        validationErrorResponse: petProblem,
      }),
    );
    app.get("/pets/:id", describeRoute({}), (c) => c.json({}));

    expect(await responses(app)).toEqual({
      "get /pets/{id}": expect.objectContaining({
        description: "The pet is invalid",
      }),
    });
  });
});
