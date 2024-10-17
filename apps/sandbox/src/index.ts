import "zod-openapi/extend";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { describeRoute, openApiSpecs } from "hono-openapi";
import { zodResolver } from "hono-openapi/zod";
import z from "zod";

const app = new Hono();

app.get(
  "/",
  ...describeRoute({
    request: {
      query: zodResolver(
        z.object({ name: z.string().optional().openapi({ example: "Steven" }) })
      ),
    },
  }),
  (c) => {
    const result = c.req.valid("query");
    return c.text(`Hello ${result?.name ?? "Hono"}!`);
  }
);

app.post(
  "/:id",
  ...describeRoute({
    request: {
      param: zodResolver(
        z.object({ id: z.coerce.number().openapi({ example: 123 }) })
      ),
    },
    requestBody: {
      content: {
        "application/json": {
          schema: zodResolver(
            z.object({ name: z.string().openapi({ example: "Steven" }) })
          ),
        },
      },
    },
  }),
  (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");

    return c.text(`Hello ${body.name}! Your id is ${params.id}`);
  }
);

app.get(
  "/docs",
  openApiSpecs(app, {
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
