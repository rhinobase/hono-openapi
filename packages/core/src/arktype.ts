import { type Hook, arktypeValidator } from "@hono/arktype-validator";
import type { Type } from "arktype";
import type { Env, MiddlewareHandler, ValidationTargets } from "hono";
import convert from "./toOpenAPISchema.js";
import type {
  HasUndefined,
  OpenAPIRouteHandlerConfig,
  ResolverResult,
} from "./types.js";
import { generateValidatorDocs, uniqueSymbol } from "./utils.js";

/**
 * Generate a resolver for an Arktype schema
 * @param schema Arktype schema
 * @returns Resolver result
 */
export function resolver<T extends Type>(schema: T): ResolverResult {
  return {
    builder: async (options?: OpenAPIRouteHandlerConfig) => ({
      schema: await convert(schema.toJsonSchema()),
    }),
    validator: (value) => {
      schema(value);
    },
  };
}

/**
 * Create a validator middleware
 * @param target Target for validation
 * @param schema Arktype schema
 * @param hook Hook for validation
 * @returns Middleware handler
 */
export function validator<
  T extends Type,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  I = T["inferIn"],
  O = T["infer"],
  V extends {
    in: HasUndefined<I> extends true
      ? { [K in Target]?: I }
      : { [K in Target]: I };
    out: { [K in Target]: O };
  } = {
    in: HasUndefined<I> extends true
      ? { [K in Target]?: I }
      : { [K in Target]: I };
    out: { [K in Target]: O };
  },
>(
  target: Target,
  schema: T,
  hook?: Hook<T["infer"], E, P>,
): MiddlewareHandler<E, P, V> {
  const middleware = arktypeValidator(target, schema, hook);

  return Object.assign(middleware, {
    [uniqueSymbol]: {
      resolver: async (config: OpenAPIRouteHandlerConfig) =>
        generateValidatorDocs(target, await resolver(schema).builder(config)),
    },
  });
}
