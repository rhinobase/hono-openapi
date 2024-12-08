import { effectValidator } from "@hono/effect-validator";
import { JSONSchema, Schema } from "effect";
import type {
  Env,
  Input as HonoInput,
  MiddlewareHandler,
  ValidationTargets,
} from "hono";
import convert from "./toOpenAPISchema";
import type {
  HasUndefined,
  OpenAPIRouteHandlerConfig,
  ResolverResult,
} from "./types";
import { generateValidatorDocs, uniqueSymbol } from "./utils";

export function resolver<Type, Context>(
  schema: Schema.Schema<Type, Context, never>,
): ResolverResult {
  return {
    builder: async (options?: OpenAPIRouteHandlerConfig) => ({
      schema: await convert(JSONSchema.make(schema)),
    }),
    validator: async (value) => {
      await Schema.decodeUnknownPromise(schema)(value);
    },
  };
}

export function validator<
  Type,
  Context,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  In = Schema.Schema<Type, Context, never>["Encoded"],
  Out = Schema.Schema<Type, Context, never>["Type"],
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
  V extends I = I,
>(
  target: Target,
  schema: Schema.Schema<Type, Context, never>,
): MiddlewareHandler<E, P, V> {
  const middleware = effectValidator(target, schema);

  // @ts-expect-error not typed well
  return Object.assign(middleware, {
    [uniqueSymbol]: {
      resolver: async (config: OpenAPIRouteHandlerConfig) =>
        generateValidatorDocs(target, await resolver(schema).builder(config)),
    },
  });
}
