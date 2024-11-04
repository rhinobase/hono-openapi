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
import type { DescribeRouteOptions, OpenAPIRouteHandlerConfig } from "./types";
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
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  E extends Env = any
>(
  target: U,
  validationFunc: ValidationFunction<
    unknown extends InputType ? ValidationTargets[U] : InputType,
    OutputType,
    E,
    P2
  >,
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
): MiddlewareHandler<E, P, V> {
  return async function $re(c, next) {
    const config = c.get(CONTEXT_KEY);

    if (config) {
      const docs = generateDocsFromSchema(config, schema);
      return c.json(docs);
    }

    return hValidator(target, validationFunc)(c, next);
  };
}

export function describeRoute<
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  E extends Env = any,
  P extends string = string,
  I extends Input = Input
>(specs: DescribeRouteOptions): MiddlewareHandler<E, P, I> {
  return async function $openAPIConfig(c, next) {
    const config = c.get(CONTEXT_KEY);

    if (config) {
      const docs = generateDocsFromSpecs(config, specs);
      return c.json(docs);
    }

    await next();
  };
}

export function generateDocsFromSchema(
  config: OpenAPIRouteHandlerConfig,
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
) {
  return {};
}

export function generateDocsFromSpecs(
  config: OpenAPIRouteHandlerConfig,
  specs: DescribeRouteOptions
) {
  return {};
}
