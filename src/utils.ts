import type { RouterRoute } from "hono/types";
import { checkOptionalParameter } from "hono/utils/url";
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

/**
 * The operation ID each operation got from its method and path, for the
 * operations nothing else gave an ID. `uniqueOperationIds` may rename these,
 * but never an ID set through `describeRoute` or `defaultOptions`.
 */
const generatedOperationIds = new WeakMap<object, string>();
// Optional-path suffixes keep their preferred ID during merging, but may be
// renamed to avoid IDs explicitly assigned to other operations.
const derivedOperationIds = new WeakMap<object, string>();

const pathParameterNames = (path: string) =>
  path
    .split("/")
    .filter((segment) => segment.startsWith(":"))
    .map((segment) => toOpenAPIPathSegment(segment).slice(1, -1));

/**
 * Hono serves a route whose path ends in optional parameters (`/notes/:id?`)
 * with and without them. OpenAPI path parameters are always required, so
 * each of those paths needs its own path item.
 */
export const expandOptionalParameters = (route: RouterRoute) => {
  const paths = checkOptionalParameter(route.path);
  if (!paths) {
    return [{ route, omitted: undefined }];
  }

  const names = pathParameterNames(route.path);

  return paths.map((path) => {
    const kept = pathParameterNames(path);
    return {
      route: { ...route, path },
      omitted: names.filter((name) => !kept.includes(name)),
    };
  });
};

/**
 * An `operationId` written in `describeRoute` is kept on the path with every
 * parameter; a path without some of them gets it suffixed with the ones it
 * leaves out, so the IDs stay unique.
 */
export const withOmittedParameters = (
  specs: RegisterSchemaPathOptions["specs"],
  omitted: string[] | undefined,
): RegisterSchemaPathOptions["specs"] => {
  if (!omitted || !specs) {
    return specs;
  }

  const expanded = {
    ...specs,
    ...(omitted.length && typeof specs.operationId === "string"
      ? {
          operationId: `${specs.operationId}Without${omitted.map(toPascalCase).join("And")}`,
        }
      : {}),
  };
  // The components a spec brought in are kept beside it rather than on it, so
  // the copy has to take them over, or pruning drops the ones only this path
  // still refers to.
  if (omitted.length && typeof expanded.operationId === "string") {
    derivedOperationIds.set(expanded, expanded.operationId);
  }
  setSpecComponents(expanded, getSpecComponents(specs));
  expandedOperations.add(expanded);

  return expanded;
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

/**
 * The operations of a route with optional parameters, one per path it is
 * expanded to, kept beside them like their components. Only these have their
 * path parameters matched to their path template.
 */
const expandedOperations = new WeakSet<object>();

const isExpandedOperation = (spec: unknown) =>
  spec != null && typeof spec === "object" && expandedOperations.has(spec);

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
  fromValidator = false,
) {
  if (!previous || !current || "$ref" in previous || "$ref" in current) {
    return current;
  }

  return {
    ...previous,
    ...current,
    // A validator only infers `required`, so a value the route described wins.
    ...(fromValidator && previous.required !== undefined
      ? { required: previous.required }
      : {}),
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
  const generatedOperationId = generateOperationId(route);
  // An ID a spec only got from its own route's path isn't one to carry over
  // to another route, so only the others count as set.
  const operationIdSpec = specs.findLast(
    (spec) =>
      spec?.operationId != null &&
      generatedOperationIds.get(spec) !== spec.operationId,
  );

  const merged = specs.reduce<OpenAPIV3_1.OperationObject>(
    (prev, spec) => {
      if (!spec || !prev) return prev;

      for (const [key, value] of Object.entries(spec)) {
        if (value == null) continue;

        if (
          key === "operationId" &&
          generatedOperationIds.get(spec) === value
        ) {
          continue;
        }

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
                (spec as Record<string, unknown>)[VALIDATION_MARKER] === true,
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
      operationId: generatedOperationId,
    },
  );

  if (!operationIdSpec) {
    generatedOperationIds.set(merged, generatedOperationId);
  } else if (derivedOperationIds.get(operationIdSpec) === merged.operationId) {
    derivedOperationIds.set(merged, merged.operationId as string);
  }

  setSpecComponents(merged, specs.flatMap(getSpecComponents));
  if (specs.some(isExpandedOperation)) {
    expandedOperations.add(merged);
  }

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

/**
 * Gives every operation whose ID was generated from its path or optional
 * parameter suffix an ID no other
 * operation in `paths` has. Different paths can generate the same ID, such as
 * `/notes/{id}` and `/notes/by-id`. The first operation keeps it, in route
 * order, and later ones get a numeric suffix (`getNotesById2`), so an ID
 * that's unique already never changes. IDs set explicitly are left as they
 * are, and generated IDs avoid them.
 */
export const uniqueOperationIds = (paths: OpenAPIV3_1.PathsObject) => {
  // Only the HTTP method slots of a Path Item hold operations; its other keys
  // (`parameters`, `servers`, `summary`, …) don't, so they're not read.
  const methods = ALLOWED_METHODS.map(
    (method) => method.toLowerCase() as OpenAPIV3_1.HttpMethods,
  );
  const operations = Object.values(paths).flatMap((item) =>
    methods.flatMap((method) => {
      const operation = item?.[method];
      return typeof operation?.operationId === "string" ? [operation] : [];
    }),
  );
  const isGenerated = (operation: OpenAPIV3_1.OperationObject) =>
    generatedOperationIds.get(operation) === operation.operationId ||
    derivedOperationIds.get(operation) === operation.operationId;

  // Every ID in use before renaming, so a suffixed ID doesn't take one that a
  // later operation has already.
  const reserved = new Set(operations.map(({ operationId }) => operationId));
  const explicit = operations.filter((operation) => !isGenerated(operation));

  operations.filter(isGenerated).reduce(
    (taken, operation) => {
      const operationId = operation.operationId as string;

      if (taken.has(operationId)) {
        operation.operationId = withFreeSuffix(
          operationId,
          (id) => taken.has(id) || reserved.has(id),
        );
      }

      return taken.add(operation.operationId as string);
    },
    new Set(explicit.map(({ operationId }) => operationId)),
  );
};

/** `operationId` with the lowest numeric suffix from 2 up that isn't used. */
const withFreeSuffix = (
  operationId: string,
  isUsed: (id: string) => boolean,
): string => {
  let suffix = 2;
  while (isUsed(`${operationId}${suffix}`)) suffix++;
  return `${operationId}${suffix}`;
};

/**
 * The parameter component a local `$ref` points at, with its name, looked up
 * among the generated components first and then the ones `documentation`
 * supplies. `generated` tells the two apart, since only a generated component
 * may be changed.
 */
const parameterComponent = (
  ref: OpenAPIV3_1.ReferenceObject,
  ctx: SpecContext,
) => {
  const prefix = "#/components/parameters/";
  if (!ref.$ref.startsWith(prefix)) {
    return undefined;
  }

  const name = ref.$ref.slice(prefix.length);
  const generated = ctx.components.parameters?.[name];
  if (generated) {
    return { generated: true, name, parameter: generated };
  }

  const documented = ctx.options.documentation?.components?.parameters?.[name];
  return documented && { generated: false, name, parameter: documented };
};

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

      if (schema.parameters && isExpandedOperation(schema)) {
        // A path parameter only exists on a path that has it, and is always
        // required there. A route with optional parameters (`/notes/:id?`)
        // gets a path item without them, which its `param` validator still
        // describes.
        const names = key
          .split("/")
          .filter((x) => x.startsWith("{"))
          .map((x) => x.slice(1, -1));

        schema.parameters = schema.parameters.flatMap(
          (x: OpenAPIV3_1.ParameterObject | OpenAPIV3_1.ReferenceObject) => {
            const component =
              "$ref" in x ? parameterComponent(x, ctx) : undefined;
            const parameter = component?.parameter ?? x;
            if ("$ref" in parameter || parameter.in !== "path") {
              return [x];
            }
            if (!names.includes(parameter.name)) {
              return [];
            }
            if (!component) {
              return [{ ...parameter, required: true }];
            }

            // OpenAPI requires every path parameter to be required, so a
            // generated component is marked required for all paths that refer
            // to it. A component from `documentation` is the user's own and is
            // published as they wrote it.
            if (component.generated && !parameter.required) {
              ctx.components.parameters = {
                ...ctx.components.parameters,
                [component.name]: { ...parameter, required: true },
              };
            }
            return [x];
          },
        );
      }

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
                const param = parameterComponent(x, ctx)?.parameter;

                // TODO: Need to figure out a way to handle this better
                if (param && !("$ref" in param)) {
                  return param.in === "path" && param.name === paramName;
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

      if (!schema.responses || Object.keys(schema.responses).length === 0) {
        schema.responses = {
          200: { description: "Successful response" },
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
export const componentRefs = (value: unknown): string[] => {
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
 * and the ones those operations or `documentation` refer to, directly or
 * through other components. An operation can refer to a component it didn't
 * bring in itself, such as a `$ref` written by hand in `describeRoute`.
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
    [...componentRefs(paths), ...componentRefs(documentation)],
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
