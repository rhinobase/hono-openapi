import type { Context, Env, Hono } from "hono";
import type {
  BlankEnv,
  BlankInput,
  BlankSchema,
  Input,
  MiddlewareHandler,
  Schema,
} from "hono/types";
import { findTargetHandler } from "hono/utils/handler";
import type { OpenAPIV3_1 } from "openapi-types";
import type {
  ContentWithResolver,
  DescribeRouteOptions,
  GenerateSpecOptions,
  HandlerUniqueProperty,
  RegisterSchemaPathOptions,
  ResponsesWithResolver,
  SpecContext,
} from "./types";
import {
  ALLOWED_METHODS,
  type AllowedMethods,
  documentedComponents,
  registerSchemaPath,
  removeExcludedPaths,
  setSpecComponents,
  uniqueSymbol,
  VALIDATION_MARKER,
} from "./utils";

const DEFAULT_OPTIONS: Partial<GenerateSpecOptions> = {
  documentation: {},
  excludeStaticFile: true,
  exclude: [],
  excludeMethods: ["OPTIONS"],
  excludeTags: [],
  defaultValidationErrorResponse: true,
};

/**
 * Default 400 response matching `@hono/standard-validator`'s error output:
 * `{ success: false, error: <issues>, data: <input> }`
 */
const DEFAULT_VALIDATION_ERROR: OpenAPIV3_1.ResponseObject = {
  description: "Validation Error",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean", enum: [false] },
          error: {
            type: "array",
            items: {},
          },
          data: {},
        },
        required: ["success", "error", "data"],
      },
    },
  },
};

/**
 * Route handler for OpenAPI specs
 * @param hono Instance of Hono
 * @param options Options for generating OpenAPI specs
 * @returns Middleware handler for OpenAPI specs
 */
export function openAPIRouteHandler<
  E extends Env = BlankEnv,
  P extends string = string,
  I extends Input = BlankInput,
  S extends Schema = BlankSchema,
>(
  hono: Hono<E, S, P>,
  options?: Partial<GenerateSpecOptions>,
): MiddlewareHandler<E, P, I> {
  let specs: OpenAPIV3_1.Document;

  return async (c) => {
    if (specs) return c.json(specs);

    specs = await generateSpecs(hono, options, c);

    return c.json(specs);
  };
}

/**
 * Generate OpenAPI specs for the given Hono instance
 * @param hono Instance of Hono
 * @param options Options for generating OpenAPI specs
 * @param config Configuration for OpenAPI route handler
 * @param Context Route context for hiding routes
 * @returns OpenAPI specs
 */
export async function generateSpecs<
  E extends Env = BlankEnv,
  P extends string = string,
  I extends Input = BlankInput,
  S extends Schema = BlankSchema,
>(hono: Hono<E, S, P>, options = DEFAULT_OPTIONS, c?: Context<E, P, I>) {
  const ctx: SpecContext = {
    components: {},
    // @ts-expect-error
    options: {
      ...DEFAULT_OPTIONS,
      ...options,
    },
    validationErrorResponse: DEFAULT_VALIDATION_ERROR,
  };

  const _documentation = ctx.options.documentation ?? {};
  const documentation = {
    ..._documentation,
    components: _documentation.components && { ..._documentation.components },
  };
  const paths = await generatePaths(hono, ctx);

  // Hide routes
  for (const path in paths) {
    for (const method in paths[path]) {
      const isHidden = getHiddenValue({
        valueOrFunc: paths[path][method]?.hide,
        method,
        path,
        c,
      });

      if (isHidden) {
        paths[path][method] = undefined;
      }
    }
  }

  // Resolve any resolver() objects inside documentation.components.responses.
  const resolvedDocumentation = documentation.components?.responses
    ? await resolveResponseSchemas(documentation.components.responses)
    : undefined;
  if (resolvedDocumentation && documentation.components) {
    documentation.components.responses = resolvedDocumentation.responses;
  }

  const documentedPaths = removeExcludedPaths(paths, ctx);

  // Components are collected from every route, including the ones hidden or
  // excluded above, so only keep those the rest of the document uses.
  const components = mergeComponentsObjects(
    documentation.components as OpenAPIV3_1.ComponentsObject,
    resolvedDocumentation?.components,
    documentedComponents(ctx.components, documentedPaths, [
      documentation,
      resolvedDocumentation?.components,
    ]),
  );

  return {
    openapi: "3.1.0",
    ...documentation,
    tags: documentation.tags?.filter(
      (tag) => !ctx.options.excludeTags?.includes(tag?.name),
    ),
    info: {
      title: "Hono Documentation",
      description: "Development documentation",
      version: "0.0.0",
      ...documentation.info,
    },
    paths: {
      ...documentedPaths,
      ...documentation.paths,
    },
    components,
  } satisfies OpenAPIV3_1.Document;
}

async function generatePaths<
  E extends Env = BlankEnv,
  P extends string = string,
  S extends Schema = BlankSchema,
>(hono: Hono<E, S, P>, ctx: SpecContext): Promise<OpenAPIV3_1.PathsObject> {
  const paths: OpenAPIV3_1.PathsObject = {};
  // Conversion awaits vendor adapters, so concurrent generations must not
  // share middleware metadata while traversing their routes.
  const pathContext = new Map<string, RegisterSchemaPathOptions["specs"]>();

  for (const route of hono.routes) {
    const middlewareHandler = findTargetHandler(route.handler)[uniqueSymbol] as
      | HandlerUniqueProperty
      | undefined;

    // Finding routes with uniqueSymbol
    if (!middlewareHandler) {
      // Include empty paths, if enabled
      if (ctx.options.includeEmptyPaths) {
        registerSchemaPath(
          {
            route,
            paths,
          },
          pathContext,
        );
      }

      continue;
    }

    const routeMethod = route.method as AllowedMethods | "ALL";

    // All method acts like a middleware, so we can skip it
    if (routeMethod !== "ALL") {
      // Exclude methods
      if (ctx.options.excludeMethods?.includes(routeMethod)) {
        continue;
      }

      // Include only allowed methods
      if (!ALLOWED_METHODS.includes(routeMethod)) {
        continue;
      }
    }

    const defaultOptionsForThisMethod = ctx.options.defaultOptions?.[
      routeMethod
    ] && { ...ctx.options.defaultOptions[routeMethod] };

    const { schema: routeSpecs, components = {} } = await getSpec(
      middlewareHandler,
      defaultOptionsForThisMethod,
      ctx.components.parameters,
    );

    ctx.components = mergeComponentsObjects(ctx.components, components);
    setSpecComponents(routeSpecs, [components]);

    registerSchemaPath(
      {
        route,
        specs: routeSpecs,
        paths,
      },
      pathContext,
    );
  }

  return paths;
}

function getHiddenValue(options: {
  valueOrFunc: DescribeRouteOptions["hide"];
  c?: Context;
  method: string;
  path: string;
}) {
  const { valueOrFunc, c, method, path } = options;

  if (valueOrFunc != null) {
    if (typeof valueOrFunc === "boolean") {
      return valueOrFunc;
    }

    if (typeof valueOrFunc === "function") {
      return valueOrFunc({ c, method, path });
    }
  }

  return false;
}

/**
 * Keywords that can make an object schema reject `{}` in ways the schema's own
 * `required` list doesn't show.
 */
const COMBINING_KEYWORDS = ["allOf", "anyOf", "oneOf", "not", "if"] as const;

/**
 * Whether a body validator needs a request body, read from the schema it
 * documents. Hono's validator validates `{}` when no body is sent, so an object
 * schema without required properties lets a route answer a request without one.
 * The validator itself is never run: the document is generated without calling
 * application code, so anything the schema can't show, such as a combination of
 * schemas, is taken to need a body. A refinement doesn't show in the schema at
 * all, so a route whose refinement rejects `{}` describes its body as `required`
 * with `describeRoute`.
 */
const needsBody = (
  schema: OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject,
  components?: OpenAPIV3_1.ComponentsObject,
) => {
  const resolved =
    "$ref" in schema
      ? components?.schemas?.[schema.$ref.split("/").at(-1) ?? ""]
      : schema;

  if (!resolved || "$ref" in resolved) {
    return true;
  }

  const types = [resolved.type].flat();
  return (
    !types.includes("object") ||
    COMBINING_KEYWORDS.some((keyword) => keyword in resolved) ||
    (resolved.required?.length ?? 0) > 0 ||
    (resolved.minProperties ?? 0) > 0
  );
};

async function getSpec(
  middlewareHandler: HandlerUniqueProperty,
  defaultOptions?: Partial<DescribeRouteOptions>,
  parameterComponents?: OpenAPIV3_1.ComponentsObject["parameters"],
) {
  // If the middleware handler has a spec, that is decribeRoute middleware
  if ("spec" in middlewareHandler) {
    const tmp = {
      ...defaultOptions,
      ...middlewareHandler.spec,
      responses: {
        ...defaultOptions?.responses,
        ...middlewareHandler.spec.responses,
      },
    };

    let components: OpenAPIV3_1.ComponentsObject = {};
    if (tmp.responses) {
      const resolved = await resolveResponseSchemas(tmp.responses);
      tmp.responses = resolved.responses;
      components = resolved.components;
    }

    if (tmp.requestBody && "content" in tmp.requestBody) {
      const resolved = await resolveContentSchemas(tmp.requestBody.content);
      tmp.requestBody = {
        ...tmp.requestBody,
        content: resolved.content,
      };
      components = mergeComponentsObjects(components, resolved.components);
    }

    return { schema: tmp, components };
  }

  const result = await middlewareHandler.toOpenAPISchema();
  liftSchemaDefs(result);
  const docs: DescribeRouteOptions & Record<string, unknown> = {
    ...defaultOptions,
    // Mark this operation as validator-derived so a default 400 validation
    // error response can be auto-injected later (see removeExcludedPaths).
    [VALIDATION_MARKER]: true,
  };

  if (
    middlewareHandler.target === "form" ||
    middlewareHandler.target === "json"
  ) {
    // Hono's `form` validator accepts both form encodings.
    const mediaTypes = middlewareHandler.options?.media
      ? [middlewareHandler.options.media]
      : middlewareHandler.target === "json"
        ? ["application/json"]
        : ["application/x-www-form-urlencoded", "multipart/form-data"];
    const content = Object.fromEntries(
      mediaTypes.map((media) => [media, { schema: result.schema }]),
    );
    if (
      !docs.requestBody ||
      !("content" in docs.requestBody) ||
      !docs.requestBody.content
    ) {
      docs.requestBody = {
        ...(needsBody(result.schema, result.components)
          ? { required: true }
          : {}),
        content,
      };
    } else {
      docs.requestBody = {
        ...docs.requestBody,
        content: { ...docs.requestBody.content, ...content },
      };
    }
  } else {
    let parameters: (
      | OpenAPIV3_1.ParameterObject
      | OpenAPIV3_1.ReferenceObject
    )[] = [];

    if ("$ref" in result.schema) {
      const ref = result.schema.$ref as string;

      const pos = ref.split("/").pop();

      if (pos && result.components?.schemas?.[pos]) {
        const schema = result.components.schemas[pos];

        const generatedParameters = generateParameters(
          middlewareHandler.target,
          schema,
          result.components.schemas,
        );

        const singleParameter =
          generatedParameters.length === 1 ? generatedParameters[0] : undefined;
        const existingParameter = parameterComponents?.[pos];
        if (
          singleParameter &&
          (!existingParameter ||
            ("in" in existingParameter &&
              existingParameter.in === singleParameter.in &&
              existingParameter.name === singleParameter.name))
        ) {
          result.components.parameters ??= {};
          result.components.parameters[pos] = singleParameter;

          // Preserve parameter references for existing single-field schemas.
          parameters.push({ $ref: `#/components/parameters/${pos}` });
          delete result.components.schemas[pos];
        } else {
          // A reference cannot name multiple parameters or different locations.
          // Inline conflicting parameters without overwriting an earlier ref.
          parameters = generatedParameters;
        }
      }
    } else {
      parameters = generateParameters(
        middlewareHandler.target,
        result.schema,
        result.components?.schemas,
      );
    }

    docs.parameters = parameters;
  }

  return { schema: docs, components: result.components };
}

function generateParameters(
  target: string,
  schema: OpenAPIV3_1.SchemaObject,
  schemas?: OpenAPIV3_1.ComponentsObject["schemas"],
) {
  const parameters: OpenAPIV3_1.ParameterObject[] = [];

  for (const [key, property] of collectParameterProperties(schema, schemas)) {
    const def: OpenAPIV3_1.ParameterObject = {
      in: target === "param" ? "path" : target,
      name: key,
      // @ts-expect-error ParameterObject uses the OpenAPI 3.0 schema type.
      schema: property.schema,
    };

    if (property.required) {
      def.required = true;
    }

    if (def.schema && "description" in def.schema && def.schema.description) {
      def.description = def.schema.description;
      def.schema = { ...def.schema, description: undefined };
    }

    parameters.push(def);
  }

  return parameters;
}

type SchemaOrReference = OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject;
type ParameterProperty = { required: boolean; schema: SchemaOrReference };
type ParameterProperties = Map<string, ParameterProperty>;

// An intersection needs every description of a field it combines, so a field
// described more than once gets an `allOf`, required when any part requires it.
const intersect = (
  entries: [string, ParameterProperty][],
): ParameterProperties =>
  entries.reduce((properties, [key, property]) => {
    const existing = properties.get(key);

    return new Map(properties).set(
      key,
      existing
        ? {
            required: existing.required || property.required,
            schema: { allOf: [existing.schema, property.schema] },
          }
        : property,
    );
  }, new Map<string, ParameterProperty>());

// A union accepts the properties of any of its variants, so it documents
// each of them, required only when every variant requires it.
const unite = (variants: ParameterProperties[]): ParameterProperties => {
  const keys = new Set(variants.flatMap((variant) => [...variant.keys()]));

  return new Map(
    [...keys].map((key) => {
      const found = variants.map((variant) => variant.get(key));
      const [first, ...others] = new Map(
        found
          .filter((property) => property !== undefined)
          .map(({ schema }) => [JSON.stringify(schema), schema]),
      ).values();

      return [
        key,
        {
          required: found.every((property) => property?.required),
          schema: others.length ? { anyOf: [first, ...others] } : first,
        },
      ];
    }),
  );
};

const collectParameterProperties = (
  schema: OpenAPIV3_1.SchemaObject,
  schemas?: OpenAPIV3_1.ComponentsObject["schemas"],
): ParameterProperties => {
  // `resolving` holds the components being expanded, so a schema that refers
  // back to itself stops instead of recursing forever.
  const collectMember = (
    member: SchemaOrReference,
    resolving: ReadonlySet<string>,
  ): ParameterProperties => {
    if (!("$ref" in member)) return collect(member, resolving);

    const prefix = "#/components/schemas/";
    if (!member.$ref.startsWith(prefix)) return new Map();

    const name = member.$ref
      .slice(prefix.length)
      .replaceAll("~1", "/")
      .replaceAll("~0", "~");
    const referencedSchema = schemas?.[name];
    if (!referencedSchema || resolving.has(name)) return new Map();

    return collect(referencedSchema, new Set(resolving).add(name));
  };

  const collect = (
    current: OpenAPIV3_1.SchemaObject,
    resolving: ReadonlySet<string>,
  ): ParameterProperties =>
    intersect([
      ...Object.entries(current.properties ?? {}).map(
        ([key, value]): [string, ParameterProperty] => [
          key,
          { required: Boolean(current.required?.includes(key)), schema: value },
        ],
      ),
      ...(current.allOf ?? []).flatMap((member) => [
        ...collectMember(member, resolving),
      ]),
      ...[current.anyOf, current.oneOf]
        .filter((variants) => variants?.length)
        .flatMap((variants = []) => [
          ...unite(
            variants.map((variant) => collectMember(variant, resolving)),
          ),
        ]),
    ]);

  return collect(schema, new Set());
};

/**
 * Resolve any resolver() objects in a responses map, returning the
 * cleaned responses and any components produced during resolution.
 */
async function resolveContentSchemas(content: ContentWithResolver) {
  let components: OpenAPIV3_1.ComponentsObject = {};
  const resolvedContent: Record<string, OpenAPIV3_1.MediaTypeObject> = {};

  for (const [contentKey, raw] of Object.entries(content)) {
    if (!raw) continue;

    if (raw.schema && "toOpenAPISchema" in raw.schema) {
      const result = await raw.schema.toOpenAPISchema();
      liftSchemaDefs(result);
      resolvedContent[contentKey] = {
        ...raw,
        schema: result.schema,
      };
      if (result.components) {
        components = mergeComponentsObjects(components, result.components);
      }
    } else {
      resolvedContent[contentKey] = raw as OpenAPIV3_1.MediaTypeObject;
    }
  }

  return { content: resolvedContent, components };
}

async function resolveResponseSchemas(responses: ResponsesWithResolver) {
  let components: OpenAPIV3_1.ComponentsObject = {};
  const resolvedResponses: OpenAPIV3_1.ResponsesObject = {};

  for (const [key, response] of Object.entries(responses)) {
    if (!response || !("content" in response) || !response.content) {
      resolvedResponses[key] = response as
        | OpenAPIV3_1.ReferenceObject
        | OpenAPIV3_1.ResponseObject;
      continue;
    }

    const resolved = await resolveContentSchemas(response.content);
    resolvedResponses[key] = {
      ...response,
      content: resolved.content,
    };
    components = mergeComponentsObjects(components, resolved.components);
  }

  return { responses: resolvedResponses, components };
}

/**
 * Some vendors (e.g. Effect Schema) emit a top-level `$defs` map on the
 * generated schema even after their inner `$ref`s have been rewritten to
 * `#/components/schemas/*`. Left as-is, the definitions end up duplicated
 * inline under the response/request schema while `components.schemas` stays
 * empty (see #227). This lifts any leftover `$defs` into `components.schemas`
 * and strips them from the schema, mutating the result in place.
 *
 * Existing `components.schemas` take precedence over the lifted `$defs`: when
 * schemas are `ref`/`$id`-annotated, the vendor already registers the real
 * definition under `components.schemas` and leaves only a self-referential
 * `{ $ref }` stub inside `$defs`, so the real definition must win.
 */
function liftSchemaDefs(result: {
  schema: OpenAPIV3_1.SchemaObject;
  components?: OpenAPIV3_1.ComponentsObject;
}) {
  const defs = (result.schema as { $defs?: Record<string, unknown> }).$defs;

  if (!defs || typeof defs !== "object") return;

  result.components ??= {};
  result.components.schemas = {
    ...defs,
    ...result.components.schemas,
  } as OpenAPIV3_1.ComponentsObject["schemas"];

  delete (result.schema as { $defs?: unknown }).$defs;
}

function mergeComponentsObjects(
  ...components: (OpenAPIV3_1.ComponentsObject | undefined)[]
) {
  return components.reduce<OpenAPIV3_1.ComponentsObject>(
    (prev, component, index) => {
      if (component == null || index === 0) return prev;

      if (
        (prev.schemas && Object.keys(prev.schemas).length > 0) ||
        (component.schemas && Object.keys(component.schemas).length > 0)
      ) {
        prev.schemas = {
          ...prev.schemas,
          ...component.schemas,
        };
      }

      if (
        (prev.parameters && Object.keys(prev.parameters).length > 0) ||
        (component.parameters && Object.keys(component.parameters).length > 0)
      ) {
        prev.parameters = {
          ...prev.parameters,
          ...component.parameters,
        };
      }

      return prev;
    },
    components[0] ?? {},
  );
}
