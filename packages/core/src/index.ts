import type { Context, Env, Hono, Input, Next } from "hono";
import { findTargetHandler, isMiddleware } from "hono/utils/handler";
import type { OpenAPIV3 } from "openapi-types";

const handlerName = "openAPIConfig";

export type DescribeRouteOptions = Partial<OpenAPIV3.OperationObject> & {
  /**
   * Pass `true` to hide route from OpenAPI/swagger document
   * */
  hide?: boolean;
};

export function describeRoute<
  E extends Env = Env,
  P extends string = string,
  I extends Input = Input
>(options: DescribeRouteOptions) {
  return async function openAPIConfig(c: Context<E, P, I>, next: Next) {
    // @ts-ignore
    if (c.get("__OPENAPI_SPECS__")) {
      return c.json(options);
    }

    await next();
  };
}

export type OpenApiSpecsOptions = {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
};

export function openApiSpecs<
  E extends Env = Env,
  P extends string = string,
  I extends Input = Input
>(hono: Hono, options: OpenApiSpecsOptions) {
  return async (c: Context<E, P, I>, next: Next) => {
    const specs = options;

    // @ts-ignore
    c.set("__OPENAPI_SPECS__", true);

    for (const { path, method, handler } of hono.routes) {
      const targetHandler = findTargetHandler(handler);

      if (!(isMiddleware(targetHandler) && handler.name === handlerName))
        continue;

      // biome-ignore lint/suspicious/noExplicitAny: this is a response object
      const response = await handler(c, next).then((res: any) => res.json());

      console.log({ path, method, ...response });
    }

    return c.json(specs);
  };
}
