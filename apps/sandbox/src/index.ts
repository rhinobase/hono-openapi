import { serve } from "@hono/node-server";
import { apiReference } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { openAPISpecs } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import routes from "./routes";
import yaml from "yaml"; // P1bee

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
  "/openapi.yaml", // P89fa
  async (c) => { // P89fa
    const specs = await openAPISpecs(app); // P89fa
    const yamlSpecs = yaml.stringify(specs); // P89fa
    return c.text(yamlSpecs, 200, { "Content-Type": "application/x-yaml" }); // P89fa
  } // P89fa
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
