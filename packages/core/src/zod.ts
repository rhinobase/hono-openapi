import type { z, ZodSchema } from "zod";
import { type Hook, zValidator } from "@hono/zod-validator";
import { createSchema, type CreateSchemaOptions } from "zod-openapi";
import type {
  ResolverResult,
  OpenAPIRouteHandlerConfig,
  HasUndefined,
} from "./types";
import type { Env, Input, MiddlewareHandler, ValidationTargets } from "hono";
import { generateValidatorDocs, uniqueSymbol } from "./utils";

export function resolver<T extends ZodSchema>(schema: T): ResolverResult {
  return {
    // @ts-expect-error Need to fix the type
    builder: (options?: OpenAPIRouteHandlerConfig) => {
      const { version, ...rest } = options ?? {};

      return createSchema(
        schema,
        options
          ? {
              openapi: version,
              ...(rest as CreateSchemaOptions),
            }
          : undefined
      );
    },
    validator: schema.parse,
  };
}

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
  const middleware = zValidator(target, schema, hook);

  // @ts-expect-error not typed well
  return Object.assign(middleware, {
    [uniqueSymbol]: {
      resolver: (config: OpenAPIRouteHandlerConfig) =>
        generateValidatorDocs(target, resolver(schema).builder(config)),
      metadata: { schemaType: "input" },
    },
  });
}
