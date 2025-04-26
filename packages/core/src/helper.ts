import type { OpenAPIV3 } from "openapi-types";
import type {
  DescribeRouteOptions,
  OpenAPIRoute,
  OpenApiSpecsOptions,
} from "./types.js";

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

export const toOpenAPIPath = (path: string) =>
  path
    .split("/")
    .map((x) => {
      let tmp = x;
      if (tmp.startsWith(":")) {
        const match = tmp.match(/^:([^{?]+)(?:{(.+)})?(\?)?$/);
        if (match) {
          const paramName = match[1];
          tmp = `{${paramName}}`;
        } else {
          tmp = tmp.slice(1, tmp.length);
          if (tmp.endsWith("?")) tmp = tmp.slice(0, -1);
          tmp = `{${tmp}}`;
        }
      }

      return tmp;
    })
    .join("/");

export const capitalize = (word: string) =>
  word.charAt(0).toUpperCase() + word.slice(1);

const generateOperationIdCache = new Map<string, string>();

export const generateOperationId = (method: string, paths: string) => {
  const key = `${method}:${paths}`;

  if (generateOperationIdCache.has(key)) {
    return generateOperationIdCache.get(key) as string;
  }

  let operationId = method;

  if (paths === "/") return `${operationId}Index`;

  for (const path of paths.split("/")) {
    if (path.charCodeAt(0) === 123) {
      operationId += `By${capitalize(path.slice(1, -1))}`;
    } else {
      operationId += capitalize(path);
    }
  }

  generateOperationIdCache.set(key, operationId);

  return operationId;
};

const schemaPathContext = new Map<string, OpenAPIRoute["data"]>();

// TODO: Improve the types
function getProperty<T>(
  obj: OpenAPIRoute["data"],
  key: keyof DescribeRouteOptions,
  defaultValue: T,
): T {
  // @ts-expect-error
  return obj && key in obj ? (obj[key] ?? defaultValue) : defaultValue;
}

function mergeRouteData(...data: OpenAPIRoute["data"][]) {
  return data.reduce<NonNullable<OpenAPIRoute["data"]>>((acc, route) => {
    if (!route) return acc;

    let tags: DescribeRouteOptions["tags"] = undefined;
    if (("tags" in acc && acc.tags) || ("tags" in route && route.tags)) {
      tags = [
        ...getProperty(acc, "tags", []),
        ...getProperty(route, "tags", []),
      ];
    }

    return {
      // biome-ignore lint/performance/noAccumulatingSpread: <explanation>
      ...acc,
      ...route,
      tags,
      responses: {
        ...getProperty(acc, "responses", {}),
        ...getProperty(route, "responses", {}),
      },
      parameters: mergeParameters(acc.parameters, route.parameters),
    };
  }, {});
}

function getPathContext(path: string) {
  const keys = Array.from(schemaPathContext.keys());

  let context: OpenAPIRoute["data"] = {};

  for (const key of keys) {
    if (path.match(key)) {
      const data = schemaPathContext.get(key) ?? {};
      context = mergeRouteData(context, data);
    }
  }

  return context;
}

export function registerSchemaPath({
  path,
  method: _method,
  data,
  schema,
}: OpenAPIRoute & {
  schema: Partial<OpenAPIV3.PathsObject>;
}) {
  path = toOpenAPIPath(path);
  const method = _method.toLowerCase() as Lowercase<OpenAPIRoute["method"]>;

  if (method === "all") {
    if (!data) return;

    if (schemaPathContext.has(path)) {
      const prev = schemaPathContext.get(path) ?? {};

      schemaPathContext.set(path, {
        ...prev,
        ...data,
        parameters: mergeParameters(prev.parameters, data.parameters),
      });
    } else {
      schemaPathContext.set(path, data);
    }
  } else {
    const dataFromContext = getPathContext(path);

    schema[path] = {
      ...(schema[path] ? schema[path] : {}),
      [method]: {
        responses: {},
        operationId: generateOperationId(method, path),
        ...mergeRouteData(dataFromContext, schema[path]?.[method], data),
      } satisfies OpenAPIV3.OperationObject,
    };
  }
}

type Parameter = OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject;

const paramKey = (param: Parameter) =>
  "$ref" in param ? param.$ref : `${param.in} ${param.name}`;

function mergeParameters(...params: (Parameter[] | undefined)[]): Parameter[] {
  const _params = params.flatMap((x) => x ?? []);

  const merged = _params.reduce((acc, param) => {
    acc.set(paramKey(param), param);
    return acc;
  }, new Map<string, Parameter>());

  return Array.from(merged.values());
}

export function filterPaths(
  paths: OpenAPIV3.PathsObject,
  {
    excludeStaticFile = true,
    exclude = [],
  }: Pick<OpenApiSpecsOptions, "excludeStaticFile" | "exclude">,
) {
  const newPaths: OpenAPIV3.PathsObject = {};
  const _exclude = Array.isArray(exclude) ? exclude : [exclude];

  for (const [key, value] of Object.entries(paths)) {
    if (
      !_exclude.some((x) => {
        if (typeof x === "string") return key === x;

        return x.test(key);
      }) &&
      !(key.includes("*") && !key.includes("{")) &&
      (excludeStaticFile ? !key.includes(".") || key.includes("{") : true)
    ) {
      // @ts-expect-error
      for (const method of Object.keys(value)) {
        // @ts-expect-error
        const schema = value[method];

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
                    params.name === x.slice(1, x.length - 1),
                ),
            );

          for (const param of pathParameters) {
            const paramName = param.slice(1, param.length - 1);

            const index = schema.parameters.findIndex(
              (x: OpenAPIV3.ParameterObject) =>
                x.in === "param" && x.name === paramName,
            );

            if (index !== -1) schema.parameters[index].in = "path";
            else
              schema.parameters.push({
                schema: { type: "string" },
                in: "path",
                name: paramName,
                required: true,
              });
          }
        }

        if (!schema.responses)
          schema.responses = {
            200: {},
          };
      }

      newPaths[key] = value;
    }
  }

  return newPaths;
}
