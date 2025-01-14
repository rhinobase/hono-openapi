import { type } from "arktype";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { validator as aValidator, resolver } from "hono-openapi/arktype";

const router = new Hono();

const nameValidation = type({
  name: "string",
});

router.get(
  "/",
  describeRoute({
    description: "Say hello to the user",
    responses: {
      200: {
        description: "Successful greeting response",
        content: {
          "text/plain": {
            schema: resolver(type("string")),
          },
        },
      },
    },
  }),
  aValidator("query", nameValidation),
  (c) => {
    const query = c.req.valid("query");
    return c.text(`Hello ${query?.name ?? "Hono"}!`);
  },
);

router.post(
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
  aValidator("query", nameValidation),
  aValidator(
    "json",
    type({
      id: "number",
    }),
  ),
  (c) => {
    const query = c.req.valid("query");
    const body = c.req.valid("json");

    return c.text(`Hello ${query.name}! Your id is ${body.id}`);
  },
);

export default router;
