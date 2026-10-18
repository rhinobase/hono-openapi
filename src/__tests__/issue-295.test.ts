import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod";
import "zod-openapi/extend";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

const Note = z
  .object({ pinned: z.boolean().default(false), title: z.string() })
  .openapi({ ref: "Note" });

const returnsNote = describeRoute({
  responses: {
    200: {
      content: { "application/json": { schema: resolver(Note) } },
      description: "OK",
    },
  },
});

describe("a response's component", () => {
  it("takes the plain name when no request refers to the input form", async () => {
    // Converting `Note.strict()` also brings in `Note` itself, unreferenced.
    const app = new Hono().post(
      "/notes",
      returnsNote,
      validator("json", Note.strict().openapi({ ref: "CreateNote" })),
      (c) => c.json({}),
    );

    const { components, paths } = await generateSpecs(app);

    expect(Object.keys(components?.schemas ?? {}).toSorted()).toEqual([
      "CreateNote",
      "Note",
    ]);
    expect(components?.schemas?.Note).toMatchObject({
      required: ["pinned", "title"],
    });
    expect(
      paths["/notes"]?.post?.responses?.[200]?.content?.["application/json"],
    ).toEqual({ schema: { $ref: "#/components/schemas/Note" } });
  });

  it("is split when a request refers to the input form", async () => {
    const app = new Hono().post(
      "/notes",
      returnsNote,
      validator(
        "json",
        z.object({ draft: Note }).openapi({ ref: "CreateNote" }),
      ),
      (c) => c.json({}),
    );

    const { components } = await generateSpecs(app);

    expect(Object.keys(components?.schemas ?? {}).toSorted()).toEqual([
      "CreateNote",
      "Note",
      "NoteOutput",
    ]);
    expect(components?.schemas?.Note).toMatchObject({ required: ["title"] });
  });

  it("is split when documentation declares the input form", async () => {
    const app = new Hono().get("/notes", returnsNote, (c) => c.json({}));

    const { components } = await generateSpecs(app, {
      documentation: {
        components: {
          schemas: {
            Note: {
              properties: { title: { type: "string" } },
              type: "object",
            },
          },
        },
      },
    });

    expect(Object.keys(components?.schemas ?? {}).toSorted()).toEqual([
      "Note",
      "NoteOutput",
    ]);
  });
});
