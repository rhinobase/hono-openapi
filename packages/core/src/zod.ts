import type { z, ZodSchema } from "zod";
import { type Hook, zValidator } from "@hono/zod-validator";
import { createSchema, type CreateSchemaOptions } from "zod-openapi";
import type { ResolverResult, OpenAPIRouteHandlerConfig } from "./types";
import type { Env, Input, MiddlewareHandler, ValidationTargets } from "hono";
import { CONTEXT_KEY } from "./utils";

export function resolver<T extends ZodSchema>(schema: T): ResolverResult {
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

type HasUndefined<T> = undefined extends T ? true : false;

export function validator<
  T extends ZodSchema,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  In = z.input<T>,
  Out = z.output<T>,
  I extends Input = {
    in: HasUndefined<In> extends true
      ? {
          [K in Target]?: In extends ValidationTargets[K]
            ? In
            : { [K2 in keyof In]?: ValidationTargets[K][K2] };
        }
      : {
          [K in Target]: In extends ValidationTargets[K]
            ? In
            : { [K2 in keyof In]: ValidationTargets[K][K2] };
        };
    out: { [K in Target]: Out };
  },
  V extends I = I
>(
  target: Target,
  schema: T,
  hook?: Hook<z.infer<T>, E, P, Target>
): MiddlewareHandler<E, P, V> {
  return async function $openAPIConfig(c, next) {
    // @ts-expect-error
    const config = c.get(CONTEXT_KEY) as OpenAPIRouteHandlerConfig | undefined;

    if (config) {
      const docs = resolver(schema)(config);
      return c.json(docs);
    }

    // @ts-expect-error not typed well
    return zValidator(target, schema, hook)(c, next);
  };
}
