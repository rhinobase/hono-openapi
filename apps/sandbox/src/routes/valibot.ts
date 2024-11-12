import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as vValidator } from "hono-openapi/valibot";
import * as v from "valibot";

const router = new Hono();

const nameValidation = v.object({
  name: v.string(),
});

router.get(
  "/",
  describeRoute({
    description: "Say hello to the user",
    hide: true,
    responses: {
      200: {
        description: "Successful greeting response",
        content: {
          "text/plain": {
            schema: resolver(v.string()),
          },
        },
      },
    },
  }),
  vValidator("query", nameValidation),
  (c) => {
    const query = c.req.valid("query");
    return c.text(`Hello ${query?.name ?? "Hono"}!`);
  }
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
  vValidator("query", nameValidation),
  vValidator(
    "json",
    v.object({
      id: v.number(),
    })
  ),
  (c) => {
    const query = c.req.valid("query");
    const body = c.req.valid("json");

    return c.text(`Hello ${query.name}! Your id is ${body.id}`);
  }
);

export default router;
