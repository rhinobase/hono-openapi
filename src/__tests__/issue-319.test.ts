import { Hono } from "hono";
import type { OpenAPIV3_1 } from "openapi-types";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

const Note = z
  .object({ pinned: z.boolean().default(false), title: z.string() })
  .meta({ ref: "Note" });
const Page = z.object({ page: z.string() }).meta({ ref: "Page" });

const documentedNote = {
  description: "A note, as the API documents it",
  properties: { title: { maxLength: 100, type: "string" } },
  required: ["title"],
  type: "object",
} satisfies OpenAPIV3_1.SchemaObject;

const generate = (app: Hono, components: OpenAPIV3_1.ComponentsObject) =>
  generateSpecs(app, { documentation: { components } });

describe("a component `documentation` declares", () => {
  it("isn't replaced by a request body's schema with the same name", async () => {
    const app = new Hono().post("/notes", validator("json", Note), (c) =>
      c.json({}),
    );

    const specs = await generate(app, { schemas: { Note: documentedNote } });

    expect(specs.components?.schemas?.Note).toEqual(documentedNote);
  });

  it("isn't replaced by a parameter with the same name", async () => {
    const documentedPage = {
      description: "The page to show",
      in: "query",
      name: "page",
      schema: { minimum: 1, type: "integer" },
    } satisfies OpenAPIV3_1.ParameterObject;
    const app = new Hono().get("/notes", validator("query", Page), (c) =>
      c.json([]),
    );

    const specs = await generate(app, {
      parameters: { Page: documentedPage },
    });

    expect(specs.components?.parameters?.Page).toEqual(documentedPage);
  });

  it("is kept next to the output form of a schema with the same name", async () => {
    const app = new Hono().post(
      "/notes",
      describeRoute({
        responses: {
          200: {
            content: { "application/json": { schema: resolver(Note) } },
            description: "OK",
          },
        },
      }),
      validator("json", Note),
      (c) => c.json({}),
    );

    const specs = await generate(app, { schemas: { Note: documentedNote } });

    expect(specs.components?.schemas).toMatchObject({
      Note: documentedNote,
      NoteOutput: { required: ["pinned", "title"] },
    });
  });

  it("is kept with the generated components when it's of another type", async () => {
    const bearer = {
      scheme: "bearer",
      type: "http",
    } satisfies OpenAPIV3_1.SecuritySchemeObject;
    const app = new Hono().post("/notes", validator("json", Note), (c) =>
      c.json({}),
    );

    const specs = await generate(app, { securitySchemes: { bearer } });

    expect(specs.components).toMatchObject({
      schemas: { Note: { required: ["title"] } },
      securitySchemes: { bearer },
    });
  });
});
