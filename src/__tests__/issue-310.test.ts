import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod";
import "zod-openapi/extend";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

const Note = z
  .object({ pinned: z.boolean().default(false), title: z.string() })
  .openapi({ ref: "Note" });

// Converting `Note.strict()` also brings in `Note` itself, unreferenced.
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
  validator("json", Note.strict().openapi({ ref: "CreateNote" })),
  (c) => c.json({}),
);

describe("a response's component with documentation components", () => {
  it("takes the plain name when documentation only declares security schemes", async () => {
    const { components } = await generateSpecs(app, {
      documentation: {
        components: {
          securitySchemes: { bearer: { scheme: "bearer", type: "http" } },
        },
      },
    });

    expect(Object.keys(components?.schemas ?? {}).toSorted()).toEqual([
      "CreateNote",
      "Note",
    ]);
    expect(components?.schemas?.Note).toMatchObject({
      required: ["pinned", "title"],
    });
    expect(components?.securitySchemes).toEqual({
      bearer: { scheme: "bearer", type: "http" },
    });
  });

  it("takes the plain name when documentation declares other schemas", async () => {
    const { components } = await generateSpecs(app, {
      documentation: {
        components: {
          schemas: {
            Tag: { properties: { name: { type: "string" } }, type: "object" },
          },
        },
      },
    });

    expect(Object.keys(components?.schemas ?? {}).toSorted()).toEqual([
      "CreateNote",
      "Note",
      "Tag",
    ]);
    expect(components?.schemas?.Note).toMatchObject({
      required: ["pinned", "title"],
    });
  });
});
