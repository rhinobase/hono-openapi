import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod/v4";
import { generateSpecs } from "../handler.js";
import { describeRoute, resolver, validator } from "../middlewares.js";

const note = z.object({ title: z.string() });

const mediaTypesOf = async (app: Hono) => {
  const specs = await generateSpecs(app);
  const body = specs.paths["/notes"]?.post?.requestBody;
  if (!body || !("content" in body)) throw new Error("Missing request body");
  return Object.keys(body.content).toSorted();
};

const send = (app: Hono, body: FormData | URLSearchParams) =>
  app.request("/notes", { method: "POST", body });

describe("form request body media types", () => {
  it("documents both encodings the form validator accepts", async () => {
    const app = new Hono().post("/notes", validator("form", note), (c) =>
      c.json(c.req.valid("form")),
    );

    const multipart = new FormData();
    multipart.set("title", "Groceries");
    expect((await send(app, multipart)).status).toBe(200);
    expect(
      (await send(app, new URLSearchParams({ title: "Groceries" }))).status,
    ).toBe(200);

    expect(await mediaTypesOf(app)).toEqual([
      "application/x-www-form-urlencoded",
      "multipart/form-data",
    ]);
  });

  it("documents only the media type given with `media`", async () => {
    const app = new Hono().post(
      "/notes",
      validator("form", note, undefined, { media: "multipart/form-data" }),
      (c) => c.json(c.req.valid("form")),
    );

    expect(await mediaTypesOf(app)).toEqual(["multipart/form-data"]);
  });

  it("adds both encodings next to a media type `describeRoute` documents", async () => {
    const app = new Hono().post(
      "/notes",
      describeRoute({
        requestBody: {
          content: { "application/json": { schema: resolver(note) } },
        },
      }),
      validator("form", note),
      (c) => c.json({}),
    );

    expect(await mediaTypesOf(app)).toEqual([
      "application/json",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
    ]);
  });

  it("leaves the `defaultOptions` passed in as they were", async () => {
    const defaultOptions = {
      POST: {
        requestBody: {
          content: { "text/plain": { schema: { type: "string" as const } } },
        },
      },
    };
    const app = new Hono()
      .post("/notes", validator("form", note), (c) => c.json({}))
      .post("/tags", validator("json", note), (c) => c.json({}));

    const specs = await generateSpecs(app, { defaultOptions });

    expect(Object.keys(defaultOptions.POST.requestBody.content)).toEqual([
      "text/plain",
    ]);
    const tags = specs.paths["/tags"]?.post?.requestBody;
    expect(tags && "content" in tags && Object.keys(tags.content)).toEqual([
      "text/plain",
      "application/json",
    ]);
  });
});
