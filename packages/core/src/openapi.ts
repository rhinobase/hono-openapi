import type { Context, Hono, Input, Next } from "hono";
import { findTargetHandler, isMiddleware } from "hono/utils/handler";
import type {
  OpenApiSpecsOptions,
  DescribeRouteOptions,
  OpenAPIRoute,
  OpenAPIRouteHandlerConfig,
} from "./types";
import type { OpenAPIV3 } from "openapi-types";
import {
  filterPaths,
  registerSchemaPath,
  CONTEXT_KEY,
  ALLOWED_METHODS,
} from "./utils";

const MIDDLEWARE_HANDLER_NAME = "$openAPIConfig";

type OpenAPIHonoEnv = {
  Variables: {
    __OPENAPI_SPECS__?: OpenAPIRouteHandlerConfig;
  };
};

export function openAPISpecs<
  E extends OpenAPIHonoEnv = OpenAPIHonoEnv,
  P extends string = string,
  I extends Input = Input
>(
  hono: Hono,
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
  }
) {
  const config: OpenAPIRouteHandlerConfig = {
    version: "3.0.3",
    components: {},
  };
  const schema: OpenAPIV3.PathsObject = {};
  let totalRoutes = 0;

  return async (c: Context<E, P, I>, next: Next) => {
    c.set(CONTEXT_KEY, config);

    if (hono.routes.length !== totalRoutes) {
      totalRoutes = hono.routes.length;

      const routes: OpenAPIRoute[] = [];

      for (const route of hono.routes) {
        const targetHandler = findTargetHandler(route.handler);

        if (
          isMiddleware(targetHandler) &&
          route.handler.name === MIDDLEWARE_HANDLER_NAME
        ) {
          const data = await route
            .handler(c, next)
            .then((res: { json: () => Promise<DescribeRouteOptions> }) =>
              res.json()
            );

          routes.push({
            method: route.method as OpenAPIRoute["method"],
            path: route.path,
            data,
          });
        }
      }

      for (const route of routes) {
        // TODO: correct this
        // if ("hide" in route.data && route.data.hide === true) return;
        if ((excludeMethods as ReadonlyArray<string>).includes(route.method))
          return;
        if (
          (ALLOWED_METHODS as ReadonlyArray<string>).includes(route.method) ===
            false &&
          route.method !== "ALL"
        )
          return;

        if (route.method === "ALL") {
          for (const method of ALLOWED_METHODS) {
            registerSchemaPath({
              ...route,
              method,
              schema,
            });
          }

          return;
        }

        registerSchemaPath({
          ...route,
          schema,
        });
      }

      // TODO: Hide all the hidden routes
    }

    return c.json({
      openapi: config.version,
      ...{
        ...documentation,
        tags: documentation.tags?.filter(
          (tag) => !excludeTags?.includes(tag?.name)
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
    } satisfies OpenAPIV3.Document);
  };
}
