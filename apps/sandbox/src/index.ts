import { serve } from "@hono/node-server";
import { apiReference } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { openAPISpecs } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import routes from "./routes";

const app = new Hono();

app.route("/", routes);

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
    defaultOptions: {
      GET: {
        responses: {
          400: {
            description: "Zod Error",
            content: {
              "application/json": {
                schema: resolver(
                  z
                    .object({
                      status: z.literal(400),
                      message: z.string(),
                    })
                    .openapi({ ref: "Bad Request" }),
                ),
              },
            },
          },
        },
      },
    },
  }),
);

app.get(
  "/",
  apiReference({
    theme: "saturn",
    spec: {
      url: "/openapi",
    },
  }),
);

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
