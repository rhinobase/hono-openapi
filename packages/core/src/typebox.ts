import { type Hook, tbValidator } from "@hono/typebox-validator";
import convert from "./toOpenAPISchema";
import type { Static, TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { Env, MiddlewareHandler, ValidationTargets } from "hono";
import type { OpenAPIRouteHandlerConfig, ResolverResult } from "./types";
import { generateValidatorDocs, uniqueSymbol } from "./utils";

export function resolver<T extends TSchema>(schema: T): ResolverResult {
  return {
    builder: async (options?: OpenAPIRouteHandlerConfig) => ({
      schema: await convert(schema),
    }),
    validator: (value) => {
      Value.Parse(schema, value);
    },
  };
}

export function validator<
  T extends TSchema,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  V extends {
    in: { [K in Target]: Static<T> };
    out: { [K in Target]: Static<T> };
  }
>(
  target: Target,
  schema: T,
  hook?: Hook<Static<T>, E, P>
): MiddlewareHandler<E, P, V> {
  const middleware = tbValidator(target, schema, hook);

  return Object.assign(middleware, {
    [uniqueSymbol]: {
      resolver: async (config: OpenAPIRouteHandlerConfig) =>
        generateValidatorDocs(target, await resolver(schema).builder(config)),
    },
  });
}
