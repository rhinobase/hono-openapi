import type { Env, Hono, Input, Schema } from "hono";
import type {
  BlankEnv,
  BlankInput,
  BlankSchema,
  MiddlewareHandler,
} from "hono/types";
import type { OpenAPIV3 } from "openapi-types";
import { ALLOWED_METHODS, filterPaths, registerSchemaPath } from "./helper";
import type {
  HandlerResponse,
  OpenAPIRoute,
  OpenAPIRouteHandlerConfig,
  OpenApiSpecsOptions,
} from "./types";
import { uniqueSymbol } from "./utils";

export function openAPISpecs<
  E extends Env = BlankEnv,
  P extends string = string,
  I extends Input = BlankInput,
  S extends Schema = BlankSchema,
>(
  hono: Hono<E, S, P>,
  {
    documentation = {},
    excludeStaticFile = true,
    exclude = [],
    excludeMethods = ["OPTIONS"],
    excludeTags = [],
  }: OpenApiSpecsOptions = {
    documentation: {},
    excludeStaticFile: true,
    exclude: [],
    excludeMethods: ["OPTIONS"],
    excludeTags: [],
  },
): MiddlewareHandler<E, P, I> {
  const config: OpenAPIRouteHandlerConfig = {
    version: "3.1.0",
    components: {},
  };
  const schema: OpenAPIV3.PathsObject = {};

  let specs: OpenAPIV3.Document | null = null;

  return async (c) => {
    if (specs) return c.json(specs);

    for (const route of hono.routes) {
      // Finding routes with uniqueSymbol
      if (!(uniqueSymbol in route.handler)) continue;

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

      const { docs, components } = await resolver({ ...config, ...metadata });

      config.components = {
        ...config.components,
        ...(components ?? {}),
      };

      if (route.method === "ALL") {
        for (const method of ALLOWED_METHODS) {
          registerSchemaPath({
            path: route.path,
            data: docs,
            method,
            schema,
          });
        }
      } else {
        registerSchemaPath({
          method: route.method as OpenAPIRoute["method"],
          path: route.path,
          data: docs,
          schema,
        });
      }
    }

    // Hide routes
    for (const path in schema) {
      for (const method in schema[path]) {
        // @ts-expect-error
        const valueOrFunc = schema[path][method]?.hide;
        if (
          valueOrFunc &&
          (typeof valueOrFunc === "boolean" ? valueOrFunc : valueOrFunc(c))
        ) {
          // @ts-expect-error
          delete schema[path][method];
        }
      }
    }

    specs = {
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
            exclude: Array.isArray(exclude) ? exclude : [exclude],
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

    return c.json(specs);
  };
}
