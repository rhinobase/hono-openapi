import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z3 from "zod";
import "zod-openapi/extend";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

const Tag = z
  .object({ label: z.string(), color: z.string().default("grey") })
  .meta({ ref: "Tag" });
const Note = z
  .object({ title: z.string(), pinned: z.boolean().default(false), tag: Tag })
  .meta({ ref: "Note" });

const returns = (schema: z.ZodType, options?: Record<string, unknown>) =>
  describeRoute({
    responses: {
      200: {
        description: "The note",
        content: {
          "application/json": { schema: resolver(schema, options) },
        },
      },
    },
  });
const asOutput = { options: { io: "output" } };

const create = (app: Hono) =>
  app.post("/notes", returns(Note, asOutput), validator("json", Note), (c) =>
    c.json(Note.parse(c.req.valid("json"))),
  );
const read = (app: Hono) =>
  app.get("/notes/:id", returns(Note, asOutput), (c) =>
    c.json(Note.parse({ title: "Groceries", tag: { label: "home" } })),
  );

const schemaRef = (content: unknown) =>
  (content as Record<string, { schema: { $ref: string } }>)["application/json"]
    .schema.$ref;

describe("issue-270", () => {
  it("gives a response its own component when its shape differs from the request's", async () => {
    const app = create(new Hono());

    const specs = await generateSpecs(app);
    const operation = specs.paths["/notes"]?.post;
    const schemas = specs.components?.schemas ?? {};

    expect(schemaRef(operation?.requestBody?.content)).toBe(
      "#/components/schemas/Note",
    );
    expect(schemaRef(operation?.responses?.[200]?.content)).toBe(
      "#/components/schemas/NoteOutput",
    );
    expect(schemas.Note?.required).toEqual(["title", "tag"]);
    expect(schemas.NoteOutput?.required).toEqual(["title", "pinned", "tag"]);
  });

  it("points a split response component at the response's copy of the schemas it uses", async () => {
    const specs = await generateSpecs(create(new Hono()));
    const schemas = specs.components?.schemas ?? {};

    expect(Object.keys(schemas).toSorted()).toEqual([
      "Note",
      "NoteOutput",
      "Tag",
      "TagOutput",
    ]);
    expect(schemas.Note?.properties?.tag).toEqual({
      $ref: "#/components/schemas/Tag",
    });
    expect(schemas.NoteOutput?.properties?.tag).toEqual({
      $ref: "#/components/schemas/TagOutput",
    });
    expect(schemas.TagOutput?.required).toEqual(["label", "color"]);
  });

  it("gives the same document whatever order the routes are registered in", async () => {
    const createFirst = await generateSpecs(read(create(new Hono())));
    const readFirst = await generateSpecs(create(read(new Hono())));

    expect(readFirst.components).toEqual(createFirst.components);
    expect(readFirst.paths).toEqual(createFirst.paths);
  });

  it("keeps one component when the request and response shapes are the same", async () => {
    const app = new Hono().post(
      "/notes",
      returns(Note, { options: { io: "input" } }),
      validator("json", Note),
      (c) => c.json(Note.parse(c.req.valid("json"))),
    );

    const specs = await generateSpecs(app);

    expect(Object.keys(specs.components?.schemas ?? {}).toSorted()).toEqual([
      "Note",
      "Tag",
    ]);
    expect(
      schemaRef(specs.paths["/notes"]?.post?.responses?.[200]?.content),
    ).toBe("#/components/schemas/Note");
  });

  it("doesn't split a component for a request only a hidden route makes", async () => {
    const app = read(new Hono()).post(
      "/notes",
      describeRoute({ hide: true }),
      validator("json", Note),
      (c) => c.json({}),
    );

    const specs = await generateSpecs(app);
    const schemas = specs.components?.schemas ?? {};

    expect(Object.keys(schemas).toSorted()).toEqual(["Note", "Tag"]);
    expect(schemas.Note?.required).toEqual(["title", "pinned", "tag"]);
    expect(
      schemaRef(specs.paths["/notes/{id}"]?.get?.responses?.[200]?.content),
    ).toBe("#/components/schemas/Note");
  });
});

describe("discriminated unions", () => {
  const Cat = z3
    .object({ kind: z3.literal("cat"), lives: z3.number().default(9) })
    .openapi({ ref: "Cat" });
  const Dog = z3
    .object({ kind: z3.literal("dog"), good: z3.boolean().default(true) })
    .openapi({ ref: "Dog" });
  const Pet = z3.discriminatedUnion("kind", [Cat, Dog]).openapi({ ref: "Pet" });

  it("maps a split union's discriminator to its output variants", async () => {
    const app = new Hono().post(
      "/pets",
      describeRoute({
        responses: {
          200: {
            description: "The pet",
            content: {
              "application/json": {
                schema: resolver(Pet, { options: { schemaType: "output" } }),
              },
            },
          },
        },
      }),
      validator("json", Pet),
      (c) => c.json(c.req.valid("json")),
    );

    const { components } = await generateSpecs(app);

    expect(components?.schemas?.PetOutput).toMatchObject({
      discriminator: {
        mapping: {
          cat: "#/components/schemas/CatOutput",
          dog: "#/components/schemas/DogOutput",
        },
      },
      oneOf: [
        { $ref: "#/components/schemas/CatOutput" },
        { $ref: "#/components/schemas/DogOutput" },
      ],
    });
    expect(components?.schemas?.Pet).toMatchObject({
      discriminator: {
        mapping: {
          cat: "#/components/schemas/Cat",
          dog: "#/components/schemas/Dog",
        },
      },
    });
  });
});
