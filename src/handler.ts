import type { Context, Env, Hono } from "hono";
import type {
  BlankEnv,
  BlankInput,
  BlankSchema,
  Input,
  MiddlewareHandler,
  Schema,
} from "hono/types";
import type { OpenAPIV3_1 } from "openapi-types";
import type {
  DescribeRouteOptions,
  GenerateSpecOptions,
  HandlerUniqueProperty,
  SanitizedGenerateSpecOptions,
} from "./types";
import {
  ALLOWED_METHODS,
  type AllowedMethods,
  registerSchemaPath,
  removeExcludedPaths,
  uniqueSymbol,
} from "./utils";

const DEFAULT_OPTIONS: Partial<GenerateSpecOptions> = {
  documentation: {},
  excludeStaticFile: true,
  exclude: [],
  excludeMethods: ["OPTIONS"],
  excludeTags: [],
};

/**
 * Route handler for OpenAPI specs
 * @param hono Instance of Hono
 * @param options Options for generating OpenAPI specs
 * @returns Middleware handler for OpenAPI specs
 */
export function openAPIRouteHandler<
  E extends Env = BlankEnv,
  P extends string = string,
  I extends Input = BlankInput,
  S extends Schema = BlankSchema,
>(
  hono: Hono<E, S, P>,
  options?: GenerateSpecOptions,
): MiddlewareHandler<E, P, I> {
  let specs: OpenAPIV3_1.Document;

  return async (c) => {
    if (specs) return c.json(specs);

    specs = await generateSpecs(hono, options, c);

    return c.json(specs);
  };
}

type SpecContext = {
  components: OpenAPIV3_1.ComponentsObject;
  options: SanitizedGenerateSpecOptions;
};

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
>(hono: Hono<E, S, P>, options = DEFAULT_OPTIONS, c?: Context<E, P, I>) {
  const ctx: SpecContext = {
    components: {},
    // @ts-expect-error
    options: {
      ...DEFAULT_OPTIONS,
      ...options,
    },
  };

  const _documentation = ctx.options.documentation ?? {};
  const schema = await generatePaths(hono, ctx);

  // Hide routes
  for (const path in schema) {
    for (const method in schema[path]) {
      const isHidden = getHiddenValue({
        valueOrFunc: schema[path][method]?.hide,
        method,
        path,
        c,
      });

      if (isHidden) {
        delete schema[path][method];
      }
    }
  }

  return {
    openapi: "3.1.0",
    ..._documentation,
    tags: _documentation.tags?.filter(
      (tag) => !ctx.options.excludeTags?.includes(tag?.name),
    ),
    info: {
      title: "Hono Documentation",
      description: "Development documentation",
      version: "0.0.0",
      ..._documentation.info,
    },
    paths: {
      ...removeExcludedPaths(schema, ctx),
      ..._documentation.paths,
    },
    components: {
      ..._documentation.components,
      schemas: {
        ...ctx.components.schemas,
        ..._documentation.components?.schemas,
      },
    },
  } satisfies OpenAPIV3_1.Document;
}

async function generatePaths<
  E extends Env = BlankEnv,
  P extends string = string,
  S extends Schema = BlankSchema,
>(hono: Hono<E, S, P>, ctx: SpecContext): Promise<OpenAPIV3_1.PathsObject> {
  const paths: OpenAPIV3_1.PathsObject = {};

  for (const route of hono.routes) {
    // Finding routes with uniqueSymbol
    if (!(uniqueSymbol in route.handler)) {
      // Include empty paths, if enabled
      if (ctx.options.includeEmptyPaths) {
        registerSchemaPath({
          route,
          paths,
        });
      }

      continue;
    }

    const routeMethod = route.method as AllowedMethods | "ALL";

    // All method acts like a middleware, so we can skip it
    if (routeMethod !== "ALL") {
      // Exclude methods
      if (ctx.options.excludeMethods?.includes(routeMethod)) {
        continue;
      }

      // Include only allowed methods
      if (!ALLOWED_METHODS.includes(routeMethod)) {
        continue;
      }
    }

    const middlewareHandler = route.handler[
      uniqueSymbol
    ] as HandlerUniqueProperty;

    const defaultOptionsForThisMethod = ctx.options.defaultOptions
      ?.[routeMethod];

    const { schema: routeSpecs, components = {} } = await getSpec(
      middlewareHandler,
      defaultOptionsForThisMethod,
    );

    ctx.components = {
      ...ctx.components,
      ...components,
      schemas: {
        ...ctx.components.schemas,
        ...components.schemas,
      },
    };

    registerSchemaPath({
      route,
      specs: routeSpecs,
      paths,
    });
  }

  return paths;
}

function getHiddenValue(options: {
  valueOrFunc: DescribeRouteOptions["hide"];
  c?: Context;
  method: string;
  path: string;
}) {
  const { valueOrFunc, c, method, path } = options;

  if (valueOrFunc != null) {
    if (typeof valueOrFunc === "boolean") {
      return valueOrFunc;
    } else if (typeof valueOrFunc === "function") {
      if (c) {
        return valueOrFunc(c);
      } else {
        console.warn(
          `'c' is not defined, cannot evaluate hide function for ${method} ${path}`,
        );
      }
    }
  }

  return false;
}

async function getSpec(
  middlewareHandler: HandlerUniqueProperty,
  defaultOptions?: Partial<DescribeRouteOptions>,
) {
  // If the middleware handler has a spec, that is decribeRoute middleware
  if ("spec" in middlewareHandler) {
    let components: OpenAPIV3_1.ComponentsObject = {};
    const tmp = {
      ...defaultOptions,
      ...middlewareHandler.spec,
      responses: {
        ...defaultOptions?.responses,
        ...middlewareHandler.spec.responses,
      },
    };

    if (tmp.responses) {
      for (const key of Object.keys(tmp.responses)) {
        const response = tmp.responses[key];

        if (!response || !("content" in response)) continue;

        for (const contentKey of Object.keys(response.content ?? {})) {
          const raw = response.content?.[contentKey];

          if (!raw) continue;

          if (raw.schema && "toOpenAPISchema" in raw.schema) {
            const result = await raw.schema.toOpenAPISchema(defaultOptions);
            raw.schema = result.schema;
            if (result.components) {
              components = {
                ...components,
                ...result.components,
              };
            }
          }
        }
      }
    }

    return { schema: tmp, components };
  }

  const result = await middlewareHandler.toOpenAPISchema();
  const docs: Pick<OpenAPIV3_1.OperationObject, "parameters" | "requestBody"> =
    {};

  if (
    middlewareHandler.target === "form" ||
    middlewareHandler.target === "json"
  ) {
    const media = middlewareHandler.target === "json"
      ? "application/json"
      : "multipart/form-data";
    if (
      !docs.requestBody ||
      !("content" in docs.requestBody) ||
      !docs.requestBody.content
    ) {
      docs.requestBody = {
        content: {
          [media]: {
            schema: result.schema,
          },
        },
      };
    } else {
      docs.requestBody.content[media] = {
        schema: result.schema,
      };
    }
  } else {
    const parameters: OpenAPIV3_1.ParameterObject[] = [];

    if ("$ref" in result.schema) {
      parameters.push({
        in: middlewareHandler.target,
        // @ts-expect-error
        name: result.schema.$ref,
        // @ts-expect-error
        schema: result.schema,
      });
    } else {
      for (
        const [key, value] of Object.entries(
          result.schema.properties ?? {},
        )
      ) {
        parameters.push({
          in: middlewareHandler.target,
          name: key,
          // @ts-expect-error
          schema: value,
          required: result.schema.required?.includes(key),
        });
      }
    }

    docs.parameters = parameters;
  }

  return { schema: docs, components: result.components };
}
