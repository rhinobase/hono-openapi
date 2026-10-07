import type { RouterRoute } from "hono/types";
import type { OpenAPIV3_1 } from "openapi-types";
import type { RegisterSchemaPathOptions, SpecContext } from "./types";

/**
 * The unique symbol for the middlewares, which makes it easier to identify them. Not meant to be used directly, unless you're creating a custom middleware.
 */
export const uniqueSymbol = Symbol.for("hono-openapi");

/**
 * Internal marker key set on an operation's spec when it is produced by a
 * `validator()` middleware. It is used to decide whether to auto-inject the
 * default 400 validation error response, and is stripped from the operation
 * before the spec is emitted. Must be an enumerable string key so it survives
 * the `Object.entries`-based merge in `mergeSpecs`.
 */
export const VALIDATION_MARKER = "__HonoOpenAPIValidator__";

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

const toOpenAPIPathSegment = (segment: string) => {
  let tmp = segment;

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
};

const toOpenAPIPath = (path: string) =>
  path.split("/").map(toOpenAPIPathSegment).join("/");

const toPascalCase = (text: string) =>
  text
    .split(/[\W_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

const generateOperationId = (route: RouterRoute) => {
  let operationId = route.method.toLowerCase();

  if (route.path === "/") return `${operationId}Index`;

  for (const segment of route.path.split("/")) {
    const openApiPathSegment = toOpenAPIPathSegment(segment);
    if (openApiPathSegment.charCodeAt(0) === 123) {
      operationId += `By${toPascalCase(openApiPathSegment.slice(1, -1))}`;
    } else {
      operationId += toPascalCase(openApiPathSegment);
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

/**
 * The components each operation's specs brought in. `mergeSpecs` carries them
 * over to the operation it builds, so an operation knows every component its
 * own route and the middleware applied to it contributed.
 */
const specComponents = new WeakMap<object, OpenAPIV3_1.ComponentsObject[]>();

export const setSpecComponents = (
  spec: object,
  components: OpenAPIV3_1.ComponentsObject[],
) => specComponents.set(spec, components);

export const getSpecComponents = (spec: unknown) =>
  (spec != null && typeof spec === "object" && specComponents.get(spec)) || [];

const specsByPathContext = new Map<
  string,
  RegisterSchemaPathOptions["specs"]
>();

function getPathContext(path: string, pathContext: typeof specsByPathContext) {
  const context: RegisterSchemaPathOptions["specs"][] = [];

  for (const [key, data] of pathContext) {
    if (!data) continue;

    // Strip trailing wildcard (e.g., "/players/*" -> "/players")
    const prefix = key.endsWith("/*") ? key.slice(0, -2) : key;

    // Context should only apply when the path starts with the prefix,
    // and either matches exactly or continues with a "/" segment boundary.
    // This prevents "/players" context from matching "/collections/players".
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      context.push(data);
    }
  }

  return context;
}

export function clearSpecsContext() {
  specsByPathContext.clear();
}

function mergeRequestBodies(
  previous: OpenAPIV3_1.OperationObject["requestBody"],
  current: OpenAPIV3_1.OperationObject["requestBody"],
) {
  if (!previous || !current || "$ref" in previous || "$ref" in current) {
    return current;
  }

  return {
    ...previous,
    ...current,
    content: {
      ...previous.content,
      ...current.content,
    },
  };
}

function mergeSpecs(
  route: RouterRoute,
  ...specs: RegisterSchemaPathOptions["specs"][]
) {
  const merged = specs.reduce<OpenAPIV3_1.OperationObject>(
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
            } else if (key === "requestBody") {
              prev.requestBody = mergeRequestBodies(
                prev.requestBody,
                value as OpenAPIV3_1.OperationObject["requestBody"],
              );
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
    },
  );

  setSpecComponents(merged, specs.flatMap(getSpecComponents));

  return merged;
}

export function registerSchemaPath(
  { route, specs, paths }: RegisterSchemaPathOptions,
  pathContext = specsByPathContext,
) {
  const path = toOpenAPIPath(route.path);
  const method = route.method.toLowerCase() as
    | Lowercase<AllowedMethods>
    | "all";

  if (method === "all") {
    if (!specs) return;

    // Merging specs with existing ones in the context
    if (pathContext.has(path)) {
      const prev = pathContext.get(path) ?? {};

      pathContext.set(path, mergeSpecs(route, prev, specs));
    } else {
      // If the specs are not present, we can just set it
      pathContext.set(path, specs);
    }
  } else {
    const context = getPathContext(path, pathContext);

    if (!(path in paths)) {
      paths[path] = {};
    }

    if (paths[path]) {
      // @ts-expect-error
      paths[path][method] = mergeSpecs(
        route,
        ...context,
        paths[path]?.[method],
        specs,
      );
    }
  }
}

export function removeExcludedPaths(
  paths: OpenAPIV3_1.PathsObject,
  ctx: SpecContext,
) {
  const { exclude, excludeStaticFile } = ctx.options;
  const newPaths: OpenAPIV3_1.PathsObject = {};
  const _exclude = Array.isArray(exclude) ? exclude : [exclude];

  for (const [key, value] of Object.entries(paths)) {
    // Skip paths with no route data
    if (value == null) continue;

    // Check if path is explicitly excluded by user configuration
    const isExplicitlyExcluded = _exclude.some((x) => {
      if (typeof x === "string") return key === x;
      return x.test(key);
    });
    if (isExplicitlyExcluded) continue;

    // Skip wildcard paths that don't have parameters (e.g., /static/*)
    // Keep wildcard paths with parameters (e.g., /users/{id}/*)
    const isWildcardWithoutParameters = key.includes("*") && !key.includes("{");
    if (isWildcardWithoutParameters) continue;

    // Apply static file filtering if enabled
    if (excludeStaticFile) {
      const hasPathParameters = key.includes("{");
      const lastSegment = key.split("/").pop() || "";
      const looksLikeStaticFile = lastSegment.includes(".");

      // Exclude files that look like static files (e.g., /style.css, /image.png)
      // But always include parameterized routes even if they have file extensions (e.g., /users/{id}.json)
      const shouldExcludeAsStaticFile =
        !hasPathParameters && looksLikeStaticFile;
      if (shouldExcludeAsStaticFile) continue;
    }

    // Path passes all filters, include it in the spec
    for (const method of Object.keys(value)) {
      const schema = value[method];

      if (schema == null) continue;

      // A `validator()` middleware marks its operation with VALIDATION_MARKER.
      // Only routes with an actual validator get the auto-injected 400 — a
      // manually documented `requestBody`/`parameters` in `describeRoute` (or
      // auto-generated path params) must NOT trigger it.
      const hasValidation = schema[VALIDATION_MARKER] === true;
      delete schema[VALIDATION_MARKER];

      if (key.includes("{")) {
        // Clone the parameters array to avoid mutating shared references
        schema.parameters = schema.parameters ? [...schema.parameters] : [];

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
            (x: OpenAPIV3_1.ParameterObject | OpenAPIV3_1.ReferenceObject) => {
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
            },
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

      // Auto-inject a 400 validation error response for routes that use validators
      if (
        hasValidation &&
        ctx.options.defaultValidationErrorResponse !== false &&
        !schema.responses["400"]
      ) {
        const errorResponse = ctx.options.defaultValidationErrorResponse;

        // Clone so each route owns its own response object — the same
        // default/custom object would otherwise be shared (by reference)
        // across every validator route (and the module-level default).
        if (typeof errorResponse === "object") {
          schema.responses["400"] = structuredClone(errorResponse);
        } else if (ctx.validationErrorResponse) {
          schema.responses["400"] = structuredClone(
            ctx.validationErrorResponse,
          );
        }
      }
    }

    // Build filtered value with only non-null methods
    const filteredValue: OpenAPIV3_1.PathItemObject = {};
    for (const method of Object.keys(value)) {
      if (value[method] != null) {
        filteredValue[method] = value[method];
      }
    }

    // Only add path if it has at least one valid method
    if (Object.keys(filteredValue).length > 0) {
      newPaths[key] = filteredValue;
    }
  }

  return newPaths;
}

const COMPONENTS_PREFIX = "#/components/";

/**
 * A component as `type/name`, the way a `$ref` names it after the prefix.
 */
const componentKey = (type: string, name: string) =>
  `${type}/${name.replaceAll("~", "~0").replaceAll("/", "~1")}`;

/**
 * Every `$ref` to a component found in `value`, as `type/name`.
 */
const componentRefs = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(componentRefs);
  }
  if (value == null || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, item]) => {
    if (key !== "$ref" || typeof item !== "string") {
      return componentRefs(item);
    }

    return item.startsWith(COMPONENTS_PREFIX)
      ? [item.slice(COMPONENTS_PREFIX.length)]
      : [];
  });
};

/**
 * `refs`, and every component they lead to through the components they point
 * at. `reached` is passed along, so each component is visited once.
 */
const reachableRefs = (
  refs: string[],
  components: OpenAPIV3_1.ComponentsObject,
  reached: Set<string>,
): Set<string> =>
  refs.reduce((seen, ref) => {
    if (seen.has(ref)) {
      return seen;
    }

    const [type, ...name] = ref.split("/");
    const component = (
      components as Record<string, Record<string, unknown> | undefined>
    )[type]?.[name.join("/").replaceAll("~1", "/").replaceAll("~0", "~")];

    return reachableRefs(componentRefs(component), components, seen.add(ref));
  }, reached);

/**
 * Keeps the generated components that the documented operations brought in,
 * and the ones `documentation` refers to, directly or through other
 * components.
 *
 * Components are collected from every route while the paths are generated,
 * including routes that are hidden or excluded afterwards. Without this, those
 * routes would still publish the schemas only they use.
 */
export function documentedComponents(
  components: OpenAPIV3_1.ComponentsObject,
  paths: OpenAPIV3_1.PathsObject,
  documentation: unknown,
) {
  const contributed = new Set(
    Object.values(paths)
      .flatMap((item) => (item == null ? [] : Object.values(item)))
      .flatMap(getSpecComponents)
      .flatMap((operationComponents) =>
        Object.entries(operationComponents).flatMap(([type, entries]) =>
          Object.keys(entries ?? {}).map((name) => componentKey(type, name)),
        ),
      ),
  );
  const kept = reachableRefs(
    componentRefs(documentation),
    components,
    contributed,
  );

  return Object.fromEntries(
    Object.entries(components).flatMap(([type, entries]) => {
      const remaining = Object.entries(entries ?? {}).filter(([name]) =>
        kept.has(componentKey(type, name)),
      );

      return remaining.length > 0
        ? [[type, Object.fromEntries(remaining)]]
        : [];
    }),
  ) as OpenAPIV3_1.ComponentsObject;
}
