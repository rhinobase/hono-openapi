import { type Hook, arktypeValidator } from "@hono/arktype-validator";
import convert from "./toOpenAPISchema";
import type { Type } from "arktype";
import type { Env, MiddlewareHandler, ValidationTargets } from "hono";
import type {
  HasUndefined,
  OpenAPIRouteHandlerConfig,
  ResolverResult,
} from "./types";
import { generateValidatorDocs, uniqueSymbol } from "./utils";

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
  }
>(
  target: Target,
  schema: T,
  hook?: Hook<T["infer"], E, P>
): MiddlewareHandler<E, P, V> {
  const middleware = arktypeValidator(target, schema, hook);

  return Object.assign(middleware, {
    [uniqueSymbol]: {
      resolver: async (config: OpenAPIRouteHandlerConfig) =>
        generateValidatorDocs(target, await resolver(schema).builder(config)),
    },
  });
}
