import type z from "zod";
import { createSchema, type CreateSchemaOptions } from "zod-openapi";
import type { ResolverResult, OpenAPIRouteHandlerConfig } from "./types";

export function zodResolver<T extends z.ZodSchema>(schema: T): ResolverResult {
  return {
    // @ts-expect-error Need to fix the type
    builder: (options?: OpenAPIRouteHandlerConfig) =>
      createSchema(
        schema,
        options
          ? {
              openapi: options.version,
              components:
                options.components as CreateSchemaOptions["components"],
            }
          : undefined
      ),
  };
}
