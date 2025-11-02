import type { RouterRoute } from "hono/types";
import type { OpenAPIV3_1 } from "openapi-types";
import type { RegisterSchemaPathOptions, SpecContext } from "./types";

/**
 * The unique symbol for the middlewares, which makes it easier to identify them. Not meant to be used directly, unless you're creating a custom middleware.
 */
export const uniqueSymbol = Symbol("openapi");

export const ALLOWED_METHODS = [
  "GET",
  "PUT",
  "POST",
  "DELETE",
  "OPTIONS",
  "HEAD",
  "PATCH",
  "TRACE",
] as const;

export type AllowedMethods = (typeof ALLOWED_METHODS)[number];

const toOpenAPIPath = (path: string) =>
  path
    .split("/")
    .map((x) => {
      let tmp = x;

      // Example - ":id"
      if (tmp.startsWith(":")) {
        const match = tmp.match(/^:([^{?]+)(?:{(.+)})?(\?)?$/);
        if (match) {
          const paramName = match[1];
          tmp = `{${paramName}}`;
        } else {
          // Remove the leading colon ":"
          tmp = tmp.slice(1, tmp.length);

          // If it ends with "?", remove it
          // This is for optional parameters
          if (tmp.endsWith("?")) tmp = tmp.slice(0, -1);

          tmp = `{${tmp}}`;
        }
      }

      return tmp;
    })
    .join("/");

const capitalize = (word: string) =>
  word.charAt(0).toUpperCase() + word.slice(1);

const generateOperationId = (route: RouterRoute) => {
  let operationId = route.method.toLowerCase();

  if (route.path === "/") return `${operationId}Index`;

  for (const segment of route.path.split("/")) {
    if (segment.charCodeAt(0) === 123) {
      operationId += `By${capitalize(segment.slice(1, -1))}`;
    } else {
      operationId += capitalize(segment);
    }
  }

  return operationId;
};

type Parameter = OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.ParameterObject;

const paramKey = (param: Parameter) =>
  "$ref" in param ? param.$ref : `${param.in} ${param.name}`;

function mergeParameters(...params: (Parameter[] | undefined)[]): Parameter[] {
  const merged = params
    .flatMap((x) => x ?? [])
    .reduce((acc, param) => {
      acc.set(paramKey(param), param);
      return acc;
    }, new Map<string, Parameter>());

  return Array.from(merged.values());
}

const specsByPathContext = new Map<
  string,
  RegisterSchemaPathOptions["specs"]
>();

function getPathContext(path: string) {
  const context: RegisterSchemaPathOptions["specs"][] = [];

  for (const [key, data] of specsByPathContext) {
    // TODO: Improve path matching https://github.com/rhinobase/hono-openapi/issues/143
    if (data && path.match(key)) {
      context.push(data);
    }
  }

  return context;
}

export function clearSpecsContext() {
  specsByPathContext.clear();
}

function mergeSpecs(
  route: RouterRoute,
  ...specs: RegisterSchemaPathOptions["specs"][]
) {
  return specs.reduce<OpenAPIV3_1.OperationObject>(
    (prev, spec) => {
      if (!spec || !prev) return prev;

      for (const [key, value] of Object.entries(spec)) {
        if (value == null) continue;

        if (
          key in prev &&
          (typeof value === "object" ||
            (typeof value === "function" && key === "operationId"))
        ) {
          if (Array.isArray(value)) {
            const values = [...(prev[key] ?? []), ...value];

            if (key === "tags") {
              prev[key] = Array.from(new Set(values));
            } else if (key === "parameters") {
              prev[key] = mergeParameters(values);
            } else {
              prev[key] = values;
            }
          } else if (typeof value === "function") {
            prev[key] = value(route);
          } else {
            if (key === "parameters") {
              // @ts-expect-error
              prev[key] = mergeParameters(prev[key], value);
            } else {
              prev[key] = {
                ...prev[key],
                ...value,
              };
            }
          }
        } else {
          prev[key] = value;
        }
      }

      return prev;
    },
    {
      operationId: generateOperationId(route),
    }
  );
}

export function registerSchemaPath({
  route,
  specs,
  paths,
}: RegisterSchemaPathOptions) {
  const path = toOpenAPIPath(route.path);
  const method = route.method.toLowerCase() as
    | Lowercase<AllowedMethods>
    | "all";

  if (method === "all") {
    if (!specs) return;

    // Merging specs with existing ones in the context
    if (specsByPathContext.has(path)) {
      const prev = specsByPathContext.get(path) ?? {};

      specsByPathContext.set(path, mergeSpecs(route, prev, specs));
    } else {
      // If the specs are not present, we can just set it
      specsByPathContext.set(path, specs);
    }
  } else {
    const pathContext = getPathContext(path);

    if (!(path in paths)) {
      paths[path] = {};
    }

    if (paths[path]) {
      // @ts-expect-error
      paths[path][method] = mergeSpecs(
        route,
        ...pathContext,
        paths[path]?.[method],
        specs
      );
    }
  }
}

export function removeExcludedPaths(
  paths: OpenAPIV3_1.PathsObject,
  ctx: SpecContext
) {
  const { exclude, excludeStaticFile } = ctx.options;
  const newPaths: OpenAPIV3_1.PathsObject = {};
  const _exclude = Array.isArray(exclude) ? exclude : [exclude];

  for (const [key, value] of Object.entries(paths)) {
    const isPathExcluded = !_exclude.some((x) => {
      if (typeof x === "string") return key === x;

      return x.test(key);
    });

    const shouldIncludePath =
      !excludeStaticFile || // Include all paths when static file filtering is disabled
      key.includes("{") || // Always include paths with parameters (e.g., /users/{id}.json)
      !key.split("/").pop()?.includes("."); // Exclude if last segment has a period (e.g., /style.css)

    if (
      isPathExcluded &&
      !(key.includes("*") && !key.includes("{")) &&
      shouldIncludePath &&
      value != null
    ) {
      for (const method of Object.keys(value)) {
        const schema = value[method];

        if (schema == null) continue;

        if (key.includes("{")) {
          if (!schema.parameters) schema.parameters = [];

          const pathParameters = key
            .split("/")
            .filter(
              (x) =>
                x.startsWith("{") &&
                !schema.parameters.find(
                  (params: Record<string, unknown>) =>
                    params.in === "path" &&
                    params.name === x.slice(1, x.length - 1)
                )
            );

          for (const param of pathParameters) {
            const paramName = param.slice(1, param.length - 1);

            const index = schema.parameters.findIndex(
              (
                x: OpenAPIV3_1.ParameterObject | OpenAPIV3_1.ReferenceObject
              ) => {
                if ("$ref" in x) {
                  const pos = x.$ref.split("/").pop();
                  if (pos) {
                    const param = ctx.components.parameters?.[pos];

                    // TODO: Need to figure out a way to handle this better
                    if (param && !("$ref" in param)) {
                      return param.in === "path" && param.name === paramName;
                    }
                  }

                  return false;
                }

                return x.in === "path" && x.name === paramName;
              }
            );

            if (index === -1) {
              schema.parameters.push({
                schema: { type: "string" },
                in: "path",
                name: paramName,
                required: true,
              });
            }
          }
        }

        if (!schema.responses) {
          schema.responses = {
            200: {},
          };
        }
      }

      newPaths[key] = value;
    }
  }

  return newPaths;
}
