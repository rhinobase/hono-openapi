import type { Env, Input, MiddlewareHandler } from "hono/types";
import type { DescribeRouteOptions, OpenAPIRouteHandlerConfig } from "./types";
import { CONTEXT_KEY } from "./utils";

export function describeRoute<
  E extends Env = Env,
  P extends string = string,
  I extends Input = Input
>(specs: DescribeRouteOptions): MiddlewareHandler<E, P, I> {
  return async function $openAPIConfig(c, next) {
    // @ts-expect-error
    const config = c.get(CONTEXT_KEY) as OpenAPIRouteHandlerConfig | undefined;

    if (config) {
      const docs = generateDocsFromSpecs(config, specs);
      return c.json({ docs });
    }

    await next();
  };
}

export function generateDocsFromSpecs(
  config: OpenAPIRouteHandlerConfig,
  specs: DescribeRouteOptions
) {
  const tmp = { ...specs };

  if (tmp.responses) {
    for (const key of Object.keys(tmp.responses)) {
      const response = tmp.responses[key];
      if (response && !("content" in response)) continue;

      for (const contentKey of Object.keys(response.content ?? {})) {
        const raw = response.content?.[contentKey];

        if (!raw) continue;

        if (raw.schema && typeof raw.schema === "function") {
          const { schema } = raw.schema(config);
          raw.schema = schema;
        }
      }
    }
  }

  return tmp;
}
