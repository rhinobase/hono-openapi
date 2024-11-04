import type z from "zod";
import { createSchema, type CreateSchemaOptions } from "zod-openapi";
import type { ResolverResult, OpenAPIRouteHandlerConfig } from "./types";

export function zResolver<T extends z.ZodSchema>(schema: T): ResolverResult {
  // @ts-expect-error Need to fix the type
  return (options?: OpenAPIRouteHandlerConfig) =>
    createSchema(
      schema,
      options
        ? {
            openapi: options.version,
            components: options.components as CreateSchemaOptions["components"],
          }
        : undefined
    );
}

export function zValidator() {}
