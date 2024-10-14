import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { describeRoute, openApiSpecs } from "hono-openapi";
import { zodResolver } from "hono-openapi/zod";
import z from "zod";

const app = new Hono();

app.get(
  "/",
  describeRoute({
    description: "This is the root route",
    parameters: [
      ...zodResolver(
        "query",
        z.object({ name: z.string().describe("Something something") })
      ),
    ],
    responses: {},
  }),
  (c) => {
    return c.text("Hello Hono!");
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
