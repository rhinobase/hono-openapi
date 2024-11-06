import type { OpenAPIV3 } from "openapi-types";
import type { OpenAPIRoute } from "./types";

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

  // TODO: Correctly merge these components

  schema[path] = {
    ...(schema[path] ? schema[path] : {}),
    [method]: {
      responses: {},
      ...(schema[path]?.[method] ?? {}),
      operationId: generateOperationId(method, path),
      ...data,
    } satisfies OpenAPIV3.OperationObject,
  };
}

export function filterPaths(
  paths: OpenAPIV3.PathsObject,
  {
    excludeStaticFile = true,
    exclude = [],
  }: {
    excludeStaticFile: boolean;
    exclude: (string | RegExp)[];
  }
) {
  const newPaths: OpenAPIV3.PathsObject = {};

  for (const [key, value] of Object.entries(paths)) {
    if (
      !exclude.some((x) => {
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

          schema.parameters = [
            ...key
              .split("/")
              .filter(
                (x) =>
                  x.startsWith("{") &&
                  !schema.parameters.find(
                    (params: Record<string, unknown>) =>
                      params.in === "path" &&
                      params.name === x.slice(1, x.length - 1)
                  )
              )
              .map((x) => ({
                schema: { type: "string" },
                in: "path",
                name: x.slice(1, x.length - 1),
                required: true,
              })),
            ...schema.parameters,
          ];
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
