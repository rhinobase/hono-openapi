import { type Hook, sValidator } from "@hono/standard-validator";
import {
  loadVendor as loadVendorJson,
  toJsonSchema,
} from "@standard-community/standard-json";
import {
  loadVendor as loadVendorOpenAPI,
  toOpenAPISchema,
} from "@standard-community/standard-openapi";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  Context,
  Env,
  Input,
  MiddlewareHandler,
  Next,
  ValidationTargets,
} from "hono";
import type { TypedResponse } from "hono/types";
import type { StatusCode } from "hono/utils/http-status";
import { validator as honoValidator } from "hono/validator";
import type { JSONSchema7 } from "json-schema";
import type { OpenAPIV3_1 } from "openapi-types";
import type {
  DescribeRouteOptions,
  PromiseOr,
  ResolverReturnType,
} from "./types";
import { uniqueSymbol } from "./utils";

export function loadVendor(
  vendor: string,
  fn: {
    toJSONSchema?: Parameters<typeof loadVendorJson>[1];
    toOpenAPISchema?: Parameters<typeof loadVendorOpenAPI>[1];
  },
) {
  if (fn.toJSONSchema) {
    loadVendorJson(vendor, fn.toJSONSchema);
  }

  if (fn.toOpenAPISchema) {
    loadVendorOpenAPI(vendor, fn.toOpenAPISchema);
  }
}

/**
 * Generate a resolver for a validation schema
 * @param schema Validation schema
 * @returns Resolver result
 */
export function resolver<Schema extends StandardSchemaV1>(
  schema: Schema,
  userDefinedOptions?: Record<string, unknown>,
) {
  return {
    vendor: schema["~standard"].vendor,
    validate: schema["~standard"].validate,
    toJSONSchema: (customOptions?: Record<string, unknown>) =>
      toJsonSchema(schema, { ...userDefinedOptions, ...customOptions }) as
        | JSONSchema7
        | Promise<JSONSchema7>,
    toOpenAPISchema: (customOptions?: Record<string, unknown>) =>
      toOpenAPISchema(schema, { ...userDefinedOptions, ...customOptions }),
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
  V extends I = I,
>(
  target: Target,
  schema: Schema,
  hook?: Hook<StandardSchemaV1.InferOutput<Schema>, E, P, Target>,
  options?: ResolverReturnType["options"],
): MiddlewareHandler<E, P, V> {
  let middleware: MiddlewareHandler<E, P, V>;

  // Check if we should use qs parsing for query parameters
  if (target === "query" && options?.qs?.enabled) {
    // Create a custom middleware that parses query string with qs first
    const qsOptions = { ...options.qs };
    delete qsOptions.enabled; // Remove our custom 'enabled' flag

    // Use hono's validator with custom query parsing
    // @ts-expect-error not typed well
    middleware = honoValidator(target, async (_value, c) => {
      // Dynamically import qs only when needed (it's an optional peer dependency)
      const qs = await import("qs");

      // Get the raw query string
      const url = new URL(c.req.url);
      const queryString = url.search.slice(1); // Remove the leading '?'

      let parsed: {
        [key: string]: unknown;
      } = {};
      if (queryString) {
        // Parse with qs instead of using the standard query parser
        parsed = qs.default.parse(queryString, qsOptions as qs.IParseOptions);
      }

      // Validate the parsed data with the schema
      const result = await schema["~standard"].validate(parsed);

      if (hook) {
        const hookResult = await hook(
          result.issues
            ? { data: parsed, error: result.issues, success: false, target }
            : { data: result.value, success: true, target },
          c,
        );
        if (hookResult) {
          if (hookResult instanceof Response) {
            return hookResult;
          }
          if ("response" in hookResult) {
            return hookResult.response;
          }
        }
      }

      if (result.issues) {
        return c.json(
          { data: parsed, error: result.issues, success: false },
          400,
        );
      }

      return result.value;
    });
  } else {
    // Use standard validator for non-query targets or when qs is disabled
    // @ts-expect-error not typed well
    middleware = sValidator(target, schema, hook);
  }

  return Object.assign(middleware, {
    [uniqueSymbol]: {
      target,
      ...resolver(schema, options),
      options,
    },
  });
}

/**
 * Describe a route with OpenAPI specs.
 * @param spec Options for describing a route
 * @returns Middleware handler
 */
export function describeRoute(spec: DescribeRouteOptions): MiddlewareHandler {
  const middleware: MiddlewareHandler = async (_c, next) => {
    await next();
  };

  return Object.assign(middleware, {
    [uniqueSymbol]: {
      spec,
    },
  });
}

type ResponseObject<T extends Partial<Record<StatusCode, StandardSchemaV1>>> = {
  [K in keyof T]:
    | OpenAPIV3_1.ReferenceObject
    | (OpenAPIV3_1.ResponseObject & {
        content?: {
          [media: string]: OpenAPIV3_1.MediaTypeObject & {
            vSchema?: T[K];
          };
        };
      });
};

type Num<T> = T extends `${infer N extends number}` ? N : T;

type HandlerResponse<
  T extends Partial<Record<StatusCode, StandardSchemaV1>> = Partial<
    Record<StatusCode, StandardSchemaV1>
  >,
> = PromiseOr<
  {
    [K in keyof T]: T[K] extends StandardSchemaV1
      ? TypedResponse<
          StandardSchemaV1.InferOutput<T[K]>,
          Num<K> extends StatusCode ? Num<K> : never
        >
      : never;
  }[keyof T]
>;

export type Handler<
  E extends Env,
  P extends string,
  I extends Input,
  T extends Partial<Record<StatusCode, StandardSchemaV1>> = Partial<
    Record<StatusCode, StandardSchemaV1>
  >,
> = (c: Context<E, P, I>, next: Next) => HandlerResponse<T>;

export function describeResponse<
  E extends Env,
  P extends string,
  I extends Input,
  T extends Partial<Record<StatusCode, StandardSchemaV1>> = Partial<
    Record<StatusCode, StandardSchemaV1>
  >,
>(
  handler: Handler<E, P, I, T>,
  responses: ResponseObject<T>,
  options?: Record<string, unknown>,
): Handler<E, P, I, T> {
  const _responses = Object.entries(responses).reduce(
    (acc, [statusCode, response]) => {
      if (response.content) {
        const content = Object.entries(response.content).reduce(
          (contentAcc, [mediaType, media]: [string, any]) => {
            if (media.vSchema) {
              const { vSchema, ...rest } = media;
              contentAcc[mediaType] = {
                ...rest,
                schema: resolver(vSchema, options),
              };
            } else {
              contentAcc[mediaType] = media;
            }
            return contentAcc;
          },
          {},
        );
        acc[statusCode] = { ...response, content };
      } else {
        acc[statusCode] = response;
      }

      return acc;
    },
    {} as NonNullable<DescribeRouteOptions["responses"]>,
  );

  return Object.assign(handler, {
    [uniqueSymbol]: {
      spec: { responses: _responses },
    },
  });
}
