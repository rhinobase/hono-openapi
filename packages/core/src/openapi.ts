import type { Context, Env, Hono, Input, Schema } from "hono";
import type {
  BlankEnv,
  BlankInput,
  BlankSchema,
  MiddlewareHandler,
} from "hono/types";
import type { OpenAPIV3 } from "openapi-types";
import { ALLOWED_METHODS, filterPaths, registerSchemaPath } from "./helper.js";
import type {
  HandlerResponse,
  OpenAPIRoute,
  OpenAPIRouteHandlerConfig,
  OpenApiSpecsOptions,
} from "./types.js";
import { uniqueSymbol } from "./utils.js";

/**
 * Route handler for OpenAPI specs
 * @param hono Instance of Hono
 * @param options Options for generating OpenAPI specs
 * @returns Middleware handler for OpenAPI specs
 */
export function openAPISpecs<
  E extends Env = BlankEnv,
  P extends string = string,
  I extends Input = BlankInput,
  S extends Schema = BlankSchema,
>(
  hono: Hono<E, S, P>,
  options?: OpenApiSpecsOptions,
): MiddlewareHandler<E, P, I> {
  const config: OpenAPIRouteHandlerConfig = {
    version: "3.1.0",
    components: {},
  };

  let specs: OpenAPIV3.Document | null = null;

  return async (c) => {
    if (specs) return c.json(specs);

    specs = await generateSpecs(hono, options, config, c);

    return c.json(specs);
  };
}

/**
 * Generate OpenAPI specs for the given Hono instance
 * @param hono Instance of Hono
 * @param options Options for generating OpenAPI specs
 * @param config Configuration for OpenAPI route handler
 * @param Context Route context for hiding routes
 * @returns OpenAPI specs
 */
export async function generateSpecs<
  E extends Env = BlankEnv,
  P extends string = string,
  I extends Input = BlankInput,
  S extends Schema = BlankSchema,
>(
  hono: Hono<E, S, P>,
  {
    documentation = {},
    includeEmptyPaths = false,
    excludeStaticFile = true,
    exclude = [],
    excludeMethods = ["OPTIONS"],
    excludeTags = [],
    defaultOptions,
  }: OpenApiSpecsOptions = {
    documentation: {},
    excludeStaticFile: true,
    exclude: [],
    excludeMethods: ["OPTIONS"],
    excludeTags: [],
  },
  { version = "3.1.0", components = {} }: OpenAPIRouteHandlerConfig = {
    version: "3.1.0",
    components: {},
  },
  c?: Context<E, P, I>,
) {
  const config: OpenAPIRouteHandlerConfig = {
    version,
    components,
  };

  const schema: OpenAPIV3.PathsObject = {};

  for (const route of hono.routes) {
    // Finding routes with uniqueSymbol
    if (!(uniqueSymbol in route.handler)) {
      // Include empty paths, if enabled
      if (includeEmptyPaths) {
        registerSchemaPath({
          method: route.method as OpenAPIRoute["method"],
          path: route.path,
          schema,
        });
      }

      continue;
    }

    // Exclude methods
    if ((excludeMethods as ReadonlyArray<string>).includes(route.method))
      continue;

    // Include only allowed methods
    if (
      (ALLOWED_METHODS as ReadonlyArray<string>).includes(route.method) ===
        false &&
      route.method !== "ALL"
    )
      continue;

    const { resolver, metadata = {} } = route.handler[
      uniqueSymbol
    ] as HandlerResponse;

    const defaultOptionsForThisMethod =
      defaultOptions?.[route.method as OpenAPIRoute["method"]];

    const { docs, components } = await resolver(
      { ...config, ...metadata },
      defaultOptionsForThisMethod,
    );

    config.components = {
      ...config.components,
      ...(components ?? {}),
    };

    registerSchemaPath({
      method: route.method as OpenAPIRoute["method"],
      path: route.path,
      data: docs,
      schema,
    });
  }

  // Hide routes
  for (const path in schema) {
    for (const method in schema[path]) {
      // @ts-expect-error
      const valueOrFunc = schema[path][method]?.hide;
      if (
        valueOrFunc &&
        (typeof valueOrFunc === "boolean"
          ? valueOrFunc
          : c
            ? valueOrFunc(c)
            : false)
      ) {
        // @ts-expect-error
        delete schema[path][method];
      }
    }
  }

  return {
    openapi: config.version,
    ...{
      ...documentation,
      tags: documentation.tags?.filter(
        (tag) => !excludeTags?.includes(tag?.name),
      ),
      info: {
        title: "Hono Documentation",
        description: "Development documentation",
        version: "0.0.0",
        ...documentation.info,
      },
      paths: {
        ...filterPaths(schema, {
          excludeStaticFile,
          exclude,
        }),
        ...documentation.paths,
      },
      components: {
        ...documentation.components,
        schemas: {
          ...config.components,
          ...documentation.components?.schemas,
        },
      },
    },
  } satisfies OpenAPIV3.Document;
}
