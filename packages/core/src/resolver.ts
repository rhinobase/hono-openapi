import type {
  Env,
  Input,
  MiddlewareHandler,
  TypedResponse,
  ValidationTargets,
} from "hono/types";
import {
  validator as hValidator,
  type ValidationFunction,
} from "hono/validator";
import type {
  DescribeRouteOptions,
  OpenAPIRouteHandlerConfig,
  ResolverResult,
} from "./types";
import type { OpenAPIV3 } from "openapi-types";

export const CONTEXT_KEY = "__OPENAPI_SPECS__";

type ValidationTargetKeysWithBody = "form" | "json";
type ValidationTargetByMethod<M> = M extends "get" | "head" // GET and HEAD request must not have a body content.
  ? Exclude<keyof ValidationTargets, ValidationTargetKeysWithBody>
  : keyof ValidationTargets;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type ExcludeResponseType<T> = T extends Response & TypedResponse<any>
  ? never
  : T;

export function validator<
  InputType,
  P extends string,
  M extends string,
  U extends ValidationTargetByMethod<M>,
  OutputType = ValidationTargets[U],
  OutputTypeExcludeResponseType = ExcludeResponseType<OutputType>,
  P2 extends string = P,
  V extends {
    in: {
      [K in U]: K extends "json"
        ? unknown extends InputType
          ? OutputTypeExcludeResponseType
          : InputType
        : {
            [K2 in keyof OutputTypeExcludeResponseType]: ValidationTargets[K][K2];
          };
    };
    out: { [K in U]: OutputTypeExcludeResponseType };
  } = {
    in: {
      [K in U]: K extends "json"
        ? unknown extends InputType
          ? OutputTypeExcludeResponseType
          : InputType
        : {
            [K2 in keyof OutputTypeExcludeResponseType]: ValidationTargets[K][K2];
          };
    };
    out: { [K in U]: OutputTypeExcludeResponseType };
  },
  E extends Env = Env
>(
  target: U,
  validationFunc: ValidationFunction<
    unknown extends InputType ? ValidationTargets[U] : InputType,
    OutputType,
    E,
    P2
  >,
  schema: ResolverResult
): MiddlewareHandler<E, P, V> {
  return async function $openAPIConfig(c, next) {
    // @ts-expect-error
    const config = c.get(CONTEXT_KEY) as OpenAPIRouteHandlerConfig | undefined;

    if (config) {
      const docs = generateDocsFromSchema(config, schema);
      return c.json(docs);
    }

    return hValidator(target, validationFunc)(c, next);
  };
}

export function describeRoute<
  E extends Env = Env,
  P extends string = string,
  I extends Input = Input
>(specs: DescribeRouteOptions): MiddlewareHandler<E, P, I> {
  return async function $openAPIConfig(c, next) {
    // @ts-expect-error
    const config = c.get(CONTEXT_KEY) as OpenAPIRouteHandlerConfig | undefined;

    if (config) {
      const docs = generateDocsFromSpecs(config, specs);
      return c.json(docs);
    }

    await next();
  };
}

export function generateDocsFromSchema(
  config: OpenAPIRouteHandlerConfig,
  schema: ResolverResult
) {
  return {};
}

export function generateDocsFromSpecs(
  config: OpenAPIRouteHandlerConfig,
  specs: DescribeRouteOptions
) {
  const tmp = { ...specs };

  if (tmp.responses) {
    for (const key of Object.keys(tmp.responses)) {
      const response = tmp.responses[key];
      if (response && !("content" in response)) continue;

      for (const contentKey of Object.keys(response.content ?? {})) {
        const raw = response.content?.[contentKey];

        if (!raw) continue;

        if (raw.schema && "builder" in raw.schema) {
          const { schema } = raw.schema.builder(config);
          raw.schema = schema;
        }
      }
    }
  }

  return tmp;
}
