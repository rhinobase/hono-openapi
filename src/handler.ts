import type { Context, Env, Hono } from "hono";
import type {
  BlankEnv,
  BlankInput,
  BlankSchema,
  Input,
  MiddlewareHandler,
  Schema,
} from "hono/types";
import { findTargetHandler } from "hono/utils/handler";
import type { OpenAPIV3_1 } from "openapi-types";
import type {
  DescribeRouteOptions,
  GenerateSpecOptions,
  HandlerUniqueProperty,
  SpecContext,
} from "./types";
import {
  ALLOWED_METHODS,
  type AllowedMethods,
  clearSpecsContext,
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
  options?: Partial<GenerateSpecOptions>,
): MiddlewareHandler<E, P, I> {
  let specs: OpenAPIV3_1.Document;

  return async (c) => {
    if (specs) return c.json(specs);

    specs = await generateSpecs(hono, options, c);

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
  clearSpecsContext();
  const paths = await generatePaths(hono, ctx);

  // Hide routes
  for (const path in paths) {
    for (const method in paths[path]) {
      const isHidden = getHiddenValue({
        valueOrFunc: paths[path][method]?.hide,
        method,
        path,
        c,
      });

      if (isHidden) {
        paths[path][method] = undefined;
      }
    }
  }

  const components = mergeComponentsObjects(
    _documentation.components,
    ctx.components,
  );

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
      ...removeExcludedPaths(paths, ctx),
      ..._documentation.paths,
    },
    components,
  } satisfies OpenAPIV3_1.Document;
}

async function generatePaths<
  E extends Env = BlankEnv,
  P extends string = string,
  S extends Schema = BlankSchema,
>(hono: Hono<E, S, P>, ctx: SpecContext): Promise<OpenAPIV3_1.PathsObject> {
  const paths: OpenAPIV3_1.PathsObject = {};

  for (const route of hono.routes) {
    const middlewareHandler = findTargetHandler(route.handler)[uniqueSymbol] as
      | HandlerUniqueProperty
      | undefined;

    // Finding routes with uniqueSymbol
    if (!middlewareHandler) {
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

    const defaultOptionsForThisMethod =
      ctx.options.defaultOptions?.[routeMethod];

    const { schema: routeSpecs, components = {} } = await getSpec(
      middlewareHandler,
      defaultOptionsForThisMethod,
    );

    ctx.components = mergeComponentsObjects(ctx.components, components);

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
    }

    if (typeof valueOrFunc === "function") {
      return valueOrFunc({ c, method, path });
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
            const result = await raw.schema.toOpenAPISchema();
            raw.schema = result.schema;
            if (result.components) {
              components = mergeComponentsObjects(
                components,
                result.components,
              );
            }
          }
        }
      }
    }

    return { schema: tmp, components };
  }

  const result = await middlewareHandler.toOpenAPISchema();
  const docs: Pick<OpenAPIV3_1.OperationObject, "parameters" | "requestBody"> =
    defaultOptions ?? {};

  if (
    middlewareHandler.target === "form" ||
    middlewareHandler.target === "json"
  ) {
    const media =
      (middlewareHandler.options?.media ?? middlewareHandler.target === "json")
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
    let parameters: (
      | OpenAPIV3_1.ParameterObject
      | OpenAPIV3_1.ReferenceObject
    )[] = [];

    if ("$ref" in result.schema) {
      const ref = result.schema.$ref as string;

      const pos = ref.split("/").pop();

      if (pos && result.components?.schemas?.[pos]) {
        const schema = result.components.schemas[pos];

        const newParameters = generateParameters(
          middlewareHandler.target,
          schema,
        )[0];

        if (!result.components.parameters) {
          result.components.parameters = {};
        }

        result.components.parameters[pos] = newParameters;

        delete result.components.schemas[pos];

        parameters.push({
          $ref: `#/components/parameters/${pos}`,
        });
      }
    } else {
      parameters = generateParameters(middlewareHandler.target, result.schema);
    }

    docs.parameters = parameters;
  }

  return { schema: docs, components: result.components };
}

function generateParameters(target: string, schema: OpenAPIV3_1.SchemaObject) {
  const parameters: OpenAPIV3_1.ParameterObject[] = [];

  for (const [key, value] of Object.entries(schema.properties ?? {})) {
    const def: OpenAPIV3_1.ParameterObject = {
      in: target === "param" ? "path" : target,
      name: key,
      // @ts-expect-error
      schema: value,
    };

    const isRequired = schema.required?.includes(key);

    if (isRequired) {
      def.required = true;
    }

    if (def.schema && "description" in def.schema && def.schema.description) {
      def.description = def.schema.description;
      def.schema.description = undefined;
    }

    parameters.push(def);
  }

  return parameters;
}

function mergeComponentsObjects(
  ...components: (OpenAPIV3_1.ComponentsObject | undefined)[]
) {
  return components.reduce<OpenAPIV3_1.ComponentsObject>(
    (prev, component, index) => {
      if (component == null || index === 0) return prev;

      if (
        (prev.schemas && Object.keys(prev.schemas).length > 0) ||
        (component.schemas && Object.keys(component.schemas).length > 0)
      ) {
        prev.schemas = {
          ...prev.schemas,
          ...component.schemas,
        };
      }

      if (
        (prev.parameters && Object.keys(prev.parameters).length > 0) ||
        (component.parameters && Object.keys(component.parameters).length > 0)
      ) {
        prev.parameters = {
          ...prev.parameters,
          ...component.parameters,
        };
      }

      return prev;
    },
    components[0] ?? {},
  );
}
