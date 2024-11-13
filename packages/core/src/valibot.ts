import { vValidator, type Hook } from "@hono/valibot-validator";
import {
  type GenericSchema,
  type GenericSchemaAsync,
  type InferInput,
  type InferOutput,
  parseAsync,
} from "valibot";
import type { ResolverResult, OpenAPIRouteHandlerConfig } from "./types";
import type {
  Env,
  Input as HonoInput,
  MiddlewareHandler,
  ValidationTargets,
} from "hono";
import { generateValidatorDocs, uniqueSymbol } from "./utils";
import { createSchema } from "valibot-openapi";

export function resolver<T extends GenericSchema | GenericSchemaAsync>(
  schema: T
): ResolverResult {
  return {
    builder: (options?: OpenAPIRouteHandlerConfig) =>
      createSchema(schema, options),
    validator: async (value) => {
      await parseAsync(schema, value);
    },
  };
}

type HasUndefined<T> = undefined extends T ? true : false;

export function validator<
  T extends GenericSchema | GenericSchemaAsync,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  In = InferInput<T>,
  Out = InferOutput<T>,
  I extends HonoInput = {
    in: HasUndefined<In> extends true
      ? {
          [K in Target]?: K extends "json"
            ? In
            : HasUndefined<keyof ValidationTargets[K]> extends true
            ? { [K2 in keyof In]?: ValidationTargets[K][K2] }
            : { [K2 in keyof In]: ValidationTargets[K][K2] };
        }
      : {
          [K in Target]: K extends "json"
            ? In
            : HasUndefined<keyof ValidationTargets[K]> extends true
            ? { [K2 in keyof In]?: ValidationTargets[K][K2] }
            : { [K2 in keyof In]: ValidationTargets[K][K2] };
        };
    out: { [K in Target]: Out };
  },
  V extends I = I
>(target: Target, schema: T, hook?: Hook<T, E, P>): MiddlewareHandler<E, P, V> {
  const middleware = vValidator(target, schema, hook);

  // @ts-expect-error not typed well
  return Object.assign(middleware, {
    [uniqueSymbol]: {
      resolver: (config: OpenAPIRouteHandlerConfig) =>
        generateValidatorDocs(target, resolver(schema).builder(config)),
    },
  });
}