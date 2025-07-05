import type { RouterRoute } from "hono/types";
import type { OpenAPIV3_1 } from "openapi-types";
import type {
  RegisterSchemaPathOptions,
  SanitizedGenerateSpecOptions,
} from "./types";

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

const generateOperationIdCache = new Map<string, string>();
const generateOperationId = (route: RouterRoute) => {
  const operationIdKey = `${route.method}:${route.path}`;

  if (generateOperationIdCache.has(operationIdKey)) {
    return generateOperationIdCache.get(operationIdKey) as string;
  }

  let operationId = route.method;

  if (route.path === "/") return `${operationId}Index`;

  for (const segment of route.path.split("/")) {
    if (segment.charCodeAt(0) === 123) {
      operationId += `By${capitalize(segment.slice(1, -1))}`;
    } else {
      operationId += capitalize(segment);
    }
  }

  generateOperationIdCache.set(operationIdKey, operationId);

  return operationId;
};

type Parameter = OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.ParameterObject;

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

function getProperty<T = unknown>(
  obj: Record<string, unknown> | undefined,
  key: string,
  defaultValue?: T,
): T | undefined {
  if (obj != null && key in obj) {
    return obj[key] as T;
  }
  return defaultValue;
}

const specsByPathContext = new Map<
  string,
  RegisterSchemaPathOptions["specs"]
>();

function getPathContext(path: string) {
  const keys = Array.from(specsByPathContext.keys());

  const context: RegisterSchemaPathOptions["specs"][] = [];

  for (const key of keys) {
    if (path.match(key)) {
      const data = specsByPathContext.get(key);

      if (!data) continue;

      context.push(data);
    }
  }

  return context;
}

function mergeSpecs(
  ...specs: (RegisterSchemaPathOptions["specs"] | undefined)[]
) {
  return specs.reduce(
    (prev, spec) => {
      if (!spec) return prev;

      return {
        ...prev,
        ...spec,
        tags: Array.from(
          new Set([
            ...(getProperty<string[]>(prev, "tags") ?? []),
            ...(getProperty<string[]>(spec, "tags") ?? []),
          ]),
        ),
        parameters: mergeParameters(
          getProperty(prev, "parameters"),
          getProperty(spec, "parameters"),
        ),
        responses: {
          ...getProperty(prev, "responses", {}),
          ...getProperty(spec, "responses", {}),
        },
      };
    },
    {} as NonNullable<RegisterSchemaPathOptions["specs"]>,
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

      specsByPathContext.set(path, mergeSpecs(prev, specs));
    } else {
      // If the specs are not present, we can just set it
      specsByPathContext.set(path, specs);
    }
  } else {
    const pathContext = getPathContext(path);

    paths[path] = {
      ...(paths[path] ? paths[path] : {}),
      [method]: {
        operationId: generateOperationId(route),
        ...mergeSpecs(...pathContext, paths[path]?.[method], specs),
      } satisfies OpenAPIV3_1.OperationObject,
    };
  }
}

export function removeExcludedPaths(
  paths: OpenAPIV3_1.PathsObject,
  ctx: { options: SanitizedGenerateSpecOptions },
) {
  const { exclude, excludeStaticFile } = ctx.options;
  const newPaths: OpenAPIV3_1.PathsObject = {};
  const _exclude = Array.isArray(exclude) ? exclude : [exclude];

  for (const [key, value] of Object.entries(paths)) {
    const isPathExcluded = !_exclude.some((x) => {
      if (typeof x === "string") return key === x;

      return x.test(key);
    });

    // If excludeStaticFile is true, we want to exclude static files
    const isStaticFileExcluded = excludeStaticFile
      ? !key.includes(".") || key.includes("{")
      : true;

    if (
      isPathExcluded &&
      !(key.includes("*") && !key.includes("{")) &&
      isStaticFileExcluded &&
      value != null
    ) {
      for (const method of Object.keys(value)) {
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
              (x: OpenAPIV3_1.ParameterObject) =>
                x.in === "param" && x.name === paramName,
            );

            if (index !== -1) schema.parameters[index].in = "path";
            else {
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
