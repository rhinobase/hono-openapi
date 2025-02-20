import type { OpenAPIV3 } from "openapi-types";
import type { OpenAPIRoute, OpenApiSpecsOptions } from "./types.js";

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
        tmp = tmp.slice(1, tmp.length);
        if (tmp.endsWith("?")) tmp = tmp.slice(0, -1);
        tmp = `{${tmp}}`;
      }

      return tmp;
    })
    .join("/");

export const capitalize = (word: string) =>
  word.charAt(0).toUpperCase() + word.slice(1);

export const generateOperationId = (method: string, paths: string) => {
  let operationId = method;

  if (paths === "/") return `${operationId}Index`;

  for (const path of paths.split("/")) {
    if (path.charCodeAt(0) === 123) {
      operationId += `By${capitalize(path.slice(1, -1))}`;
    } else {
      operationId += capitalize(path);
    }
  }

  return operationId;
};

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

  schema[path] = {
    ...(schema[path] ? schema[path] : {}),
    [method]: {
      responses: {},
      ...(schema[path]?.[method] ?? {}),
      operationId: generateOperationId(method, path),
      ...data,
      parameters: mergeParameters(
        schema[path]?.[method]?.parameters ?? [],
        data.parameters ?? [],
      ),
    } satisfies OpenAPIV3.OperationObject,
  };
}

type Parameter = OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject;

function mergeParameters(
  params1: Parameter[],
  params2: Parameter[],
): Parameter[] {
  const paramKey = (param: Parameter) =>
    "$ref" in param ? param.$ref : `${param.in} ${param.name}`;

  if (params1.length === 0 || params2.length === 0) {
    return params1.length === 0 ? params2 : params1;
  }

  const params2Map = params2.reduce((acc, param) => {
    acc.set(paramKey(param), param);
    return acc;
  }, new Map<string, Parameter>());

  const merged = params1.reduce((acc, param1) => {
    const key = paramKey(param1);
    const param2 = params2Map.get(key);

    params2Map.delete(key);
    acc.push(param2 ?? param1);

    return acc;
  }, [] as Parameter[]);

  merged.push(...params2Map.values());

  return merged;
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
      !key.includes("*") &&
      (excludeStaticFile ? !key.includes(".") : true)
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
