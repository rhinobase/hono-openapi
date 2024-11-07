# Hono OpenAPI

This can automatically generate the OpenAPI specification for the Hono API using your validation schema, which can be used to generate client libraries, documentation, and more.

Supported Validation Libraries:

- [x] [Zod](https://zod.dev/)
- [ ] [TypeBox](https://github.com/sinclairzx81/typebox) (coming soon)
- [ ] [Valibot](https://valibot.dev/) (coming soon)

> [!Note]
> This package doesn't validate the responses schema, it only generates the OpenAPI specification from it. You should use the validation library to validate your response data, if you wanna do it.

## Usage

To generate the OpenAPI specification, run the following command:

```bash
pnpm add hono-openapi
```

And you can now start defining your routes and generating the OpenAPI specification. Here is an example using Zod:

```ts
// For extending the Zod schema with OpenAPI properties
import "zod-openapi/extend";

import z from "zod";
import { Hono } from "hono";
import { zodResolver } from "hono-openapi/zod";
import { zValidator } from "@hono/zod-validator";
import { describeRoute, openAPISpecs } from "hono-openapi";

const app = new Hono();

const schema = z.object({
  name: z.string().optional().openapi({ example: "Steven", ref: "name" }),
});

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
    responses: {
      200: {
        description: "Successful greeting response",
        content: {
          "text/plain": {
            schema: {
              type: "string",
              example: "Hello Steven!",
            },
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
```
