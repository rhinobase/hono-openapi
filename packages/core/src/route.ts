import { HTTPException } from "hono/http-exception";
import type { MiddlewareHandler } from "hono/types";
import type { DescribeRouteOptions, OpenAPIRouteHandlerConfig } from "./types";
import { uniqueSymbol } from "./utils";

export function describeRoute(specs: DescribeRouteOptions): MiddlewareHandler {
  const { validateResponse, ...docs } = specs;

  const middleware: MiddlewareHandler = async (c, next) => {
    await next();

    if (validateResponse && specs.responses) {
      const status = c.res.status;
      const contentType = c.res.headers.get("content-type");

      if (status && contentType) {
        const response = specs.responses[status];
        if (response && "content" in response && response.content) {
          const splitedContentType = contentType.split(";")[0];
          const content = response.content[splitedContentType];

          if (content?.schema && "validator" in content.schema) {
            try {
              let data: unknown;

              if (splitedContentType === "application/json") {
                data = await c.res.json();
              } else if (splitedContentType === "text/plain") {
                data = await c.res.text();
              }

              if (!data) throw new Error("No data to validate!");

              await content.schema.validator(data);
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
