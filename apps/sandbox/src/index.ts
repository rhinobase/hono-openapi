import "zod-openapi/extend";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { describeRoute, openAPISpecs } from "hono-openapi";
import { zodResolver } from "hono-openapi/zod";
import z from "zod";
import { zValidator } from "@hono/zod-validator";

const app = new Hono();

const nameValidation = z.object({
  name: z.string().optional().openapi({ example: "Steven" }),
});

app.get(
  "/",
  describeRoute({
    request: {
      query: zodResolver(nameValidation),
    },
  }),
  zValidator("query", nameValidation),
  (c) => {
    const result = c.req.valid("query");
    return c.text(`Hello ${result?.name ?? "Hono"}!`);
  }
);

const idValidation = z.object({
  id: z.coerce.number().openapi({ example: 123 }),
});
const bodyValidation = z.object({
  name: z.string().openapi({ example: "Steven" }),
});

app.post(
  "/:id",
  describeRoute({
    request: {
      param: zodResolver(idValidation),
    },
    requestBody: {
      content: {
        "application/json": {
          schema: zodResolver(bodyValidation),
        },
      },
    },
  }),
  zValidator("param", idValidation),
  zValidator("json", bodyValidation),
  (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");

    return c.text(`Hello ${body.name}! Your id is ${params.id}`);
  }
);

app.get(
  "/docs",
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

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
