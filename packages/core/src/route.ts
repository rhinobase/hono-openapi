import { HTTPException } from "hono/http-exception";
import type { Env, Input, MiddlewareHandler } from "hono/types";
import type { DescribeRouteOptions, OpenAPIRouteHandlerConfig } from "./types";
import { uniqueSymbol } from "./utils";

export function describeRoute<
  E extends Env = Env,
  P extends string = string,
  I extends Input = Input,
>(specs: DescribeRouteOptions<E, P, I>): MiddlewareHandler<E, P, I> {
  const middleware: MiddlewareHandler<E, P, I> = async (c, next) => {
    await next();

    if (specs.validateResponse && specs.responses) {
      const status = c.res.status;
      const contentType = c.res.headers.get("content-type");

      if (status && contentType) {
        const response = specs.responses[status];
        if (response && "content" in response && response.content) {
          const content = response.content[contentType];
          if (content?.schema && "validator" in content.schema) {
            try {
              await content.schema.validator(c.res.body);
            } catch (error) {
              throw new HTTPException(400, {
                message: "Response validation failed!",
              });
            }
          }
        }
      }
    }
  };

  return Object.assign(middleware, {
    [uniqueSymbol]: {
      resolver: async (config: OpenAPIRouteHandlerConfig) => {
        const docs = { ...specs };
        let components = {};

        if (docs.responses) {
          for (const key of Object.keys(docs.responses)) {
            const response = docs.responses[key];
            if (response && !("content" in response)) continue;

            for (const contentKey of Object.keys(response.content ?? {})) {
              const raw = response.content?.[contentKey];

              if (!raw) continue;

              if (raw.schema && "builder" in raw.schema) {
                const result = await raw.schema.builder(config);
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

        return { docs, components };
      },
    },
  });
}
