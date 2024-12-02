import { type Hook, vValidator } from "@hono/valibot-validator";
import convert from "@openapi-contrib/json-schema-to-openapi-schema";
import { toJsonSchema } from "@valibot/to-json-schema";
import type {
  Env,
  Input as HonoInput,
  MiddlewareHandler,
  ValidationTargets,
} from "hono";
import {
  type BaseIssue,
  type BaseSchema,
  type GenericSchema,
  type GenericSchemaAsync,
  type InferInput,
  type InferOutput,
  parseAsync,
} from "valibot";
import type { OpenAPIRouteHandlerConfig, ResolverResult } from "./types";
import { generateValidatorDocs, uniqueSymbol } from "./utils";

export function resolver<
  T extends BaseSchema<unknown, unknown, BaseIssue<unknown>>,
>(schema: T): ResolverResult {
  return {
    builder: async (options?: OpenAPIRouteHandlerConfig) => ({
      schema: await convert(toJsonSchema(schema)),
    }),
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
  V extends I = I,
>(target: Target, schema: T, hook?: Hook<T, E, P>): MiddlewareHandler<E, P, V> {
  const middleware = vValidator(target, schema, hook);

  // @ts-expect-error not typed well
  return Object.assign(middleware, {
    [uniqueSymbol]: {
      resolver: async (config: OpenAPIRouteHandlerConfig) =>
        // @ts-expect-error Need to fix the type
        generateValidatorDocs(target, await resolver(schema).builder(config)),
    },
  });
}
