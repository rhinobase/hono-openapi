import { Schema } from "effect";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { validator as effectValidator, resolver } from "hono-openapi/effect";

const router = new Hono();

const nameValidation = Schema.Struct({
  name: Schema.String,
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
            schema: resolver(Schema.String),
          },
        },
      },
    },
  }),
  effectValidator("query", nameValidation),
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
  effectValidator("query", nameValidation),
  effectValidator(
    "json",
    Schema.Struct({
      id: Schema.Number,
    }),
  ),
  (c) => {
    const query = c.req.valid("query");
    const body = c.req.valid("json");

    return c.text(`Hello ${query.name}! Your id is ${body.id}`);
  },
);

export default router;
