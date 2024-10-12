import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { describeRoute, openApiSpecs } from "hono-openapi";

const app = new Hono();

app.get(
  "/",
  describeRoute({
    description: "This is the root route",
  }),
  (c) => {
    return c.text("Hello Hono!");
  }
);

app.get(
  "/docs",
  openApiSpecs(app, {
    openapi: "3.0.0",
    info: { title: "Hono", version: "1.0.0" },
  })
);

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
