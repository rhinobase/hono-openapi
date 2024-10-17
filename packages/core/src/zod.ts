import type z from "zod";
import { createSchema, type CreateSchemaOptions } from "zod-openapi";
import { zValidator } from "@hono/zod-validator";
import type { ResolverResult } from "./types";

export function zodResolver<T extends z.ZodSchema>(schema: T): ResolverResult {
  return {
    // @ts-expect-error Need to fix the type
    builder: (options?: CreateSchemaOptions) => createSchema(schema, options),
    validator: (target) => zValidator(target, schema),
  };
}
