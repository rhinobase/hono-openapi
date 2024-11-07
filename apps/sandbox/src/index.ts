import { serve } from "@hono/node-server";
import { apiReference } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { describeRoute, openAPISpecs } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import z from "zod";
import "zod-openapi/extend";

const app = new Hono();

const nameValidation = z.object({
  name: z
    .string()
    .optional()
    .openapi({ example: "Steven", description: "User Name", ref: "name" }),
});

app.get(
  "/",
  describeRoute({
    description: "Say hello to the user",
    hide: true,
    responses: {
      200: {
        description: "Successful greeting response",
        content: {
          "text/plain": {
            schema: resolver(z.string().openapi({ example: "Hello Steven!" })),
          },
        },
      },
    },
  }),
  zValidator("query", nameValidation),
  (c) => {
    const query = c.req.valid("query");
    return c.text(`Hello ${query?.name ?? "Hono"}!`);
  }
);

app.post(
  "/",
  describeRoute({
    description: "Create a new user",
    responses: {
      200: {
        description: "Successful user creation response",
        content: {
          "text/plain": {
            schema: {
              type: "string",
              example: "Hello Steven! Your id is 123",
            },
          },
        },
      },
    },
  }),
  zValidator("query", nameValidation),
  zValidator(
    "json",
    z.object({
      id: z.number().openapi({ example: 123 }),
    })
  ),
  (c) => {
    const query = c.req.valid("query");
    const body = c.req.valid("json");

    return c.text(`Hello ${query.name}! Your id is ${body.id}`);
  }
);

app.get(
  "/openapi",
  openAPISpecs(app, {
    documentation: {
      info: {
        title: "Hono",
        version: "1.0.0",
        description: "API for greeting an creating users",
      },
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
