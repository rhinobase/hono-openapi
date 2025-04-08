import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import z from "zod";
import "zod-openapi/extend";

const router = new Hono();

const nameValidation = z.object({
  name: z
    .string()
    .optional()
    .openapi({ example: "Steven", description: "User Name", ref: "name" }),
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
  zValidator("query", nameValidation),
  zValidator(
    "json",
    z.object({
      id: z.number().openapi({ example: 123 }),
    }),
  ),
  zValidator(
    "form",
    z.object({
      file: z.instanceof(File),
    }),
  ),
  (c) => {
    const query = c.req.valid("query");
    const body = c.req.valid("json");

    return c.text(`Hello ${query.name}! Your id is ${body.id}`);
  },
);

export default router;
