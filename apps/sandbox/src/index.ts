import { serve } from "@hono/node-server";
import { apiReference } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { describeRoute, openAPISpecs } from "hono-openapi";
import { zResolver as zValidator } from "hono-openapi/zod";
import z from "zod";
import "zod-openapi/extend";

const app = new Hono();

const nameValidation = z.object({
  name: z.string().openapi({ example: "Steven", ref: "name" }),
});

app.get("/", describeRoute({}), zValidator("query", nameValidation), (c) => {
  const result = c.req.valid("query");
  return c.text(`Hello ${result?.name ?? "Hono"}!`);
});

const bodyValidation = z.object({
  id: z.number().openapi({ example: 123 }),
});

app.post(
  "/",
  describeRoute({}),
  zValidator("param", nameValidation),
  zValidator("json", bodyValidation),
  (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");

    return c.text(`Hello ${params.name}! Your id is ${body.id}`);
  }
);

app.get(
  "/openapi",
  openAPISpecs(app, {
    documentation: {
      info: { title: "Hono", version: "1.0.0" },
      servers: [
        {
          url: "http://localhost:3000",
          description: "Local server",
        },
      ],
    },
  })
);

app.get(
  "/docs",
  apiReference({
    theme: "saturn",
    spec: {
      url: "/openapi",
    },
  })
);

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
