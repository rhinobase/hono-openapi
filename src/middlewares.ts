import { type Hook, sValidator } from "@hono/standard-validator";
import type { Env, Input, MiddlewareHandler, ValidationTargets } from "hono";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { toJsonSchema } from "@standard-community/standard-json";
import { toOpenAPISchema } from "@standard-community/standard-openapi";
import { uniqueSymbol } from "./utils";
import { DescribeRouteOptions } from "./types";

/**
 * Generate a resolver for a validation schema
 * @param schema Validation schema
 * @returns Resolver result
 */
export function resolver<Schema extends StandardSchemaV1>(schema: Schema) {
  return {
    vendor: schema["~standard"].vendor,
    validate: schema["~standard"].validate,
    toJSONSchema: (options?: Record<string, unknown>) =>
      toJsonSchema(schema, options),
    toOpenAPI: (options?: Record<string, unknown>) =>
      toOpenAPISchema(schema, options),
  };
}

type HasUndefined<T> = undefined extends T ? true : false;

/**
 * Create a validator middleware
 * @param target Target for validation
 * @param schema Validation schema
 * @param hook Hook for validation
 * @returns Middleware handler
 */
export function validator<
  Schema extends StandardSchemaV1,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  In = StandardSchemaV1.InferInput<Schema>,
  Out = StandardSchemaV1.InferOutput<Schema>,
  I extends Input = {
    in: HasUndefined<In> extends true ? {
        [K in Target]?: In extends ValidationTargets[K] ? In
          : { [K2 in keyof In]?: ValidationTargets[K][K2] };
      }
      : {
        [K in Target]: In extends ValidationTargets[K] ? In
          : { [K2 in keyof In]: ValidationTargets[K][K2] };
      };
    out: { [K in Target]: Out };
  },
  V extends I = I,
>(
  target: Target,
  schema: Schema,
  hook?: Hook<StandardSchemaV1.InferOutput<Schema>, E, P, Target>,
  options?: Record<string, unknown>,
): MiddlewareHandler<E, P, V> {
  const middleware = sValidator(target, schema, hook);

  // @ts-expect-error not typed well
  return Object.assign(middleware, {
    [uniqueSymbol]: {
      target,
      ...resolver(schema),
      options,
    },
  });
}

/**
 * Describe a route with OpenAPI specs.
 * @param specs Options for describing a route
 * @returns Middleware handler
 */
export function describeRoute(specs: DescribeRouteOptions): MiddlewareHandler {
  const middleware: MiddlewareHandler = async (_c, next) => {
    await next();
  };

  return Object.assign(middleware, {
    [uniqueSymbol]: {
      specs,
    },
  });
}
