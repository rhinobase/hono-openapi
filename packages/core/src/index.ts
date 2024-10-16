import type { Context, Env, Hono, Input, Next } from "hono";
import { findTargetHandler, isMiddleware } from "hono/utils/handler";
import type {
  OpenApiSpecsOptions,
  DescribeRouteOptions,
  OpenAPIRoute,
} from "./types";
import type { OpenAPIV3 } from "openapi-types";
import { filterPaths, registerSchemaPath } from "./utils";

const MIDDLEWARE_HANDLER_NAME = "openAPIConfig";
const CONTEXT_KEY = "__OPENAPI_SPECS__";

export function describeRoute<
  E extends Env = Env,
  P extends string = string,
  I extends Input = Input
>(options: DescribeRouteOptions) {
  return async function openAPIConfig(c: Context<E, P, I>, next: Next) {
    // @ts-ignore
    if (c.get(CONTEXT_KEY)) {
      return c.json(options);
    }

    await next();
  };
}

export function openApiSpecs<
  E extends Env = Env,
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
  const schema: OpenAPIV3.PathsObject = {};
  let totalRoutes = 0;

  return async (c: Context<E, P, I>, next: Next) => {
    // @ts-ignore
    c.set(CONTEXT_KEY, true);

    const routes = await Promise.all(
      hono.routes.map(async (route) => {
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
          return {
            method: route.method,
            path: route.path,
            data,
          } as OpenAPIRoute;
        }

        return undefined;
      })
    ).then((routes) => routes.filter((route) => route !== undefined));

    if (routes.length !== totalRoutes) {
      const ALLOWED_METHODS = [
        "GET",
        "PUT",
        "POST",
        "DELETE",
        "OPTIONS",
        "HEAD",
        "PATCH",
        "TRACE",
      ];
      totalRoutes = routes.length;

      for (const route of routes) {
        if (route.data.hide === true) return;
        if (excludeMethods.includes(route.method)) return;
        if (
          ALLOWED_METHODS.includes(route.method) === false &&
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
    }

    return c.json({
      openapi: "3.0.3",
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
            // TODO: Need to figure out what this is
            // ...app.definitions?.type,
            ...documentation.components?.schemas,
          },
        },
      },
    } satisfies OpenAPIV3.Document);
  };
}

function generateOpenAPISpecs({ request, ...options }: DescribeRouteOptions) {
  const tmp = { ...options };

  if (request) {
    tmp.parameters ??= [];

    if (request.cookie) {
      request.cookie = {
        schema: request.cookie.schema,
        validator: () => {},
      };
    }

    if (request.header) {
      request.header = {
        schema: request.header.schema,
        validator: () => {},
      };
    }

    if (request.param) {
      request.param = {
        schema: request.param.schema,
        validator: () => {},
      };
    }

    if (request.query) {
      request.query = {
        schema: request.query.schema,
        validator: () => {},
      };
    }
  }
}
