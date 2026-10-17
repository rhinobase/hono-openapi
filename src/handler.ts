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
import {
  componentRefs,
  decodeName,
  encodeName,
  renameSchemaRefs,
  SCHEMA_REF,
} from "./references";
import type {
  ContentWithResolver,
  DescribeRouteOptions,
  GenerateSpecOptions,
  HandlerUniqueProperty,
  HeadersWithResolver,
  RegisterSchemaPathOptions,
  ResponsesWithResolver,
  SchemaDirection,
  SpecContext,
} from "./types";
import {
  ALLOWED_METHODS,
  type AllowedMethods,
  documentedComponents,
  expandOptionalParameters,
  registerSchemaPath,
  removeExcludedPaths,
  setSpecComponents,
  uniqueOperationIds,
  uniqueSymbol,
  VALIDATION_MARKER,
  withOmittedParameters,
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
  uniqueOperationIds({ ...documentedPaths, ...documentation.paths });

  // Components are collected from every route, including the ones hidden or
  // excluded above, so only keep those the rest of the document uses.
  const { components, paths: outputPaths } = splitOutputComponents(
    mergeComponentsObjects(
      documentation.components as OpenAPIV3_1.ComponentsObject,
      resolvedDocumentation?.components,
      documentedComponents(
        ctx.components,
        documentedPaths,
        withOutputRefs([documentation, resolvedDocumentation?.components], ctx),
      ),
    ),
    documentedPaths,
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
      ...outputPaths,
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
        expandOptionalParameters(route).forEach((expanded) =>
          registerSchemaPath(
            {
              route: expanded.route,
              paths,
            },
            pathContext,
          ),
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

    const {
      schema: routeSpecs,
      components = {},
      unreferencedComponents,
    } = await getSpec(
      middlewareHandler,
      defaultOptionsForThisMethod,
      ctx.components.parameters,
    );

    ctx.components = mergeComponentsObjects(
      ctx.components,
      components,
      unreferencedComponents,
    );
    setSpecComponents(routeSpecs, [components]);

    expandOptionalParameters(route).forEach((expanded) =>
      registerSchemaPath(
        {
          route: expanded.route,
          specs: withOmittedParameters(routeSpecs, expanded.omitted),
          paths,
        },
        pathContext,
      ),
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

    return { schema: tmp, components, unreferencedComponents: undefined };
  }

  const result = await middlewareHandler.toOpenAPISchema();
  liftSchemaDefs(result);
  let unreferencedComponents: OpenAPIV3_1.ComponentsObject | undefined;
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

          // The schema is still published when something else refers to it,
          // but this operation doesn't, so it doesn't count as brought in by it.
          unreferencedComponents = { schemas: { [pos]: schema } };
          delete result.components.schemas[pos];
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

  return {
    schema: docs,
    components: result.components,
    unreferencedComponents,
  };
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

    if (def.schema && "deprecated" in def.schema && def.schema.deprecated) {
      def.deprecated = true;
      def.schema = { ...def.schema, deprecated: undefined };
    }

    // A field that refers to a named schema carries that schema's annotations
    // only on the component, which other fields and bodies share, so they are
    // read from it without being moved off it.
    const referenced =
      def.schema && "$ref" in def.schema
        ? referencedSchema(def.schema.$ref, schemas)
        : undefined;
    if (referenced?.description && !def.description) {
      def.description = referenced.description;
    }
    if (referenced?.deprecated) {
      def.deprecated = true;
    }

    parameters.push(def);
  }

  return parameters;
}

/** The component a local `#/components/schemas/…` reference points at. */
const referencedSchema = (
  $ref: string,
  schemas?: OpenAPIV3_1.ComponentsObject["schemas"],
) => {
  const prefix = "#/components/schemas/";
  if (!$ref.startsWith(prefix)) {
    return undefined;
  }

  const name = $ref
    .slice(prefix.length)
    .replaceAll("~1", "/")
    .replaceAll("~0", "~");
  return schemas?.[name];
};

type SchemaOrReference = OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject;
type ParameterProperty = { required: boolean; schema: SchemaOrReference };
type ParameterProperties = Map<string, ParameterProperty>;

// An intersection needs every description of a field it combines, so a field
// described more than once gets an `allOf`, required when any part requires it.
const intersect = (
  entries: [string, ParameterProperty][],
): ParameterProperties => {
  const properties: ParameterProperties = new Map();
  for (const [key, property] of entries) {
    const existing = properties.get(key);

    properties.set(
      key,
      existing
        ? {
            required: existing.required || property.required,
            schema: { allOf: [existing.schema, property.schema] },
          }
        : property,
    );
  }
  return properties;
};

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
 * The headers with their resolver() schemas converted in `direction`, and the
 * components the conversions produced.
 */
const resolveHeaders = async (
  headers: HeadersWithResolver,
  direction?: SchemaDirection,
) => {
  const resolved = await Promise.all(
    Object.entries(headers).map(async ([name, header]) => {
      // A boolean schema (`true`, `false`) is valid JSON Schema and can't hold a
      // resolver, so only an object is looked into.
      if (
        "$ref" in header ||
        typeof header.schema !== "object" ||
        header.schema === null ||
        !("toOpenAPISchema" in header.schema)
      ) {
        return { components: undefined, entry: [name, header] };
      }

      const result = await header.schema.toOpenAPISchema(undefined, direction);
      liftSchemaDefs(result);
      return {
        components: result.components,
        entry: [name, { ...header, schema: result.schema }],
      };
    }),
  );

  return {
    components: mergeComponentsObjects(
      {},
      ...resolved.map(({ components }) => components),
    ),
    headers: Object.fromEntries(resolved.map(({ entry }) => entry)) as Record<
      string,
      OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.HeaderObject
    >,
  };
};

/**
 * A media type's encoding with the resolver() schemas in its headers converted
 * in `direction`, the direction of the body it describes, and the components
 * the conversions produced.
 */
const resolveEncoding = async (
  encoding: NonNullable<ContentWithResolver[string]["encoding"]>,
  direction?: SchemaDirection,
) => {
  const resolved = await Promise.all(
    Object.entries(encoding).map(async ([property, entry]) => {
      if (!entry.headers) {
        return { components: undefined, entry: [property, entry] };
      }

      const { components, headers } = await resolveHeaders(
        entry.headers,
        direction,
      );
      return { components, entry: [property, { ...entry, headers }] };
    }),
  );

  return {
    components: mergeComponentsObjects(
      {},
      ...resolved.map(({ components }) => components),
    ),
    encoding: Object.fromEntries(
      resolved.map(({ entry }) => entry),
    ) as OpenAPIV3_1.MediaTypeObject["encoding"],
  };
};

/**
 * Resolve any resolver() objects in a responses map, returning the
 * cleaned responses and any components produced during resolution.
 */
async function resolveContentSchemas(
  content: ContentWithResolver,
  direction?: SchemaDirection,
) {
  let components: OpenAPIV3_1.ComponentsObject = {};
  const resolvedContent: Record<string, OpenAPIV3_1.MediaTypeObject> = {};

  for (const [contentKey, raw] of Object.entries(content)) {
    if (!raw) continue;

    const encoding = raw.encoding
      ? await resolveEncoding(raw.encoding, direction)
      : undefined;
    const media = encoding ? { ...raw, encoding: encoding.encoding } : raw;
    if (encoding) {
      components = mergeComponentsObjects(components, encoding.components);
    }

    if (media.schema && "toOpenAPISchema" in media.schema) {
      const result = await media.schema.toOpenAPISchema(undefined, direction);
      liftSchemaDefs(result);
      resolvedContent[contentKey] = {
        ...media,
        schema: result.schema,
      } as OpenAPIV3_1.MediaTypeObject;
      if (result.components) {
        components = mergeComponentsObjects(components, result.components);
      }
    } else {
      resolvedContent[contentKey] = media as OpenAPIV3_1.MediaTypeObject;
    }
  }

  return { content: resolvedContent, components };
}

async function resolveResponseSchemas(responses: ResponsesWithResolver) {
  let components: OpenAPIV3_1.ComponentsObject = {};
  const resolvedResponses: OpenAPIV3_1.ResponsesObject = {};

  for (const [key, response] of Object.entries(responses)) {
    if (
      !response ||
      "$ref" in response ||
      (!response.content && !response.headers)
    ) {
      resolvedResponses[key] = response as
        | OpenAPIV3_1.ReferenceObject
        | OpenAPIV3_1.ResponseObject;
      continue;
    }

    // A response's headers come with the response, so they're converted as
    // output, like its content.
    const content = response.content
      ? await resolveContentSchemas(response.content, "output")
      : undefined;
    const headers = response.headers
      ? await resolveHeaders(response.headers, "output")
      : undefined;
    resolvedResponses[key] = {
      ...response,
      ...(content && { content: content.content }),
      ...(headers && { headers: headers.headers }),
    } as OpenAPIV3_1.ResponseObject;
    components = mergeComponentsObjects(
      components,
      content?.components,
      headers?.components,
    );
  }

  return markAsOutput(resolvedResponses, components);
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

/**
 * Responses describe what a route sends, which can differ from what the same
 * named schema accepts in a request body: a `.default()` makes a field
 * optional in one and always present in the other. Components produced for a
 * response are kept apart under this marked name until
 * `splitOutputComponents` knows whether a request uses the same name with
 * another shape, so neither replaces the other while routes are collected.
 */
const OUTPUT_MARK = "\u0000output";

const isOutput = (name: string) => name.endsWith(OUTPUT_MARK);

const inputName = (output: string) => output.slice(0, -OUTPUT_MARK.length);

const markAsOutput = (
  responses: OpenAPIV3_1.ResponsesObject,
  components: OpenAPIV3_1.ComponentsObject,
) => {
  const schemas = components.schemas ?? {};
  const mark = (name: string) =>
    Object.hasOwn(schemas, name) ? `${name}${OUTPUT_MARK}` : undefined;

  return {
    responses: renameSchemaRefs(responses, mark, true),
    components: {
      ...components,
      ...(components.schemas && {
        schemas: Object.fromEntries(
          Object.entries(schemas).map(([name, schema]) => [
            `${name}${OUTPUT_MARK}`,
            renameSchemaRefs(schema, mark),
          ]),
        ),
      }),
    },
  };
};

/**
 * `documentation` plus a reference to the marked name of every schema it
 * refers to that only a response produced. Documentation names components by
 * their own name, which they only get back in `splitOutputComponents`, so
 * without this they'd be dropped as unused before then.
 */
const withOutputRefs = (documentation: unknown, ctx: SpecContext) => [
  documentation,
  componentRefs(documentation)
    .filter((ref) => ref.startsWith("schemas/"))
    .map((ref) => decodeName(ref.slice("schemas/".length)))
    .filter(
      (name) =>
        !Object.hasOwn(ctx.components.schemas ?? {}, name) &&
        Object.hasOwn(ctx.components.schemas ?? {}, `${name}${OUTPUT_MARK}`),
    )
    .map((name) => ({
      $ref: `${SCHEMA_REF}${encodeName(`${name}${OUTPUT_MARK}`)}`,
    })),
];

/** JSON with object keys sorted, so two schemas compare by their content. */
const canonical = (value: unknown) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).toSorted(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );

/**
 * The first of `name`, `name2`, `name3` and so on that isn't in `used`.
 */
const freeName = (name: string, used: ReadonlySet<string>): string => {
  let candidate = name;
  for (let suffix = 2; used.has(candidate); suffix++) {
    candidate = `${name}${suffix}`;
  }
  return candidate;
};

/**
 * `<name>Output` for each split response component, in order, each one free
 * of the names taken so far.
 */
const assignOutputNames = (
  outputs: string[],
  taken: Iterable<string>,
): Map<string, string> => {
  const used = new Set(taken);
  const names = new Map<string, string>();
  for (const output of outputs) {
    const name = freeName(`${inputName(output)}Output`, used);
    used.add(name);
    names.set(output, name);
  }
  return names;
};

/**
 * Gives every response component its final name, once the documented routes
 * are known:
 *
 * - When no request body uses its name, it takes the name as is.
 * - When one does with the same shape, both share one component.
 * - When the shapes differ, the response gets its own `<name>Output`, the
 *   suffix `zod-openapi` uses for the same case, so the request body and the
 *   response each describe what they accept and send. A response component
 *   that refers to a split one is split too, since the request's copy refers
 *   to the request's shape.
 *
 * Deciding this after hidden and excluded routes are removed keeps a hidden
 * route from splitting a component for the routes that remain, and deciding it
 * once for all routes keeps the result independent of their order.
 */
const splitOutputComponents = (
  components: OpenAPIV3_1.ComponentsObject,
  paths: OpenAPIV3_1.PathsObject,
) => {
  const { schemas = {}, ...otherComponents } = components;
  const outputs = Object.keys(schemas).filter(isOutput);

  if (outputs.length === 0) {
    return { components, paths };
  }

  const asInput = (name: string) =>
    isOutput(name) ? inputName(name) : undefined;
  const shared = new Set(
    outputs.filter((output) => Object.hasOwn(schemas, inputName(output))),
  );
  const outputRefs = new Map(
    [...shared].map(
      (output) =>
        [
          output,
          componentRefs(schemas[output])
            .filter((ref) => ref.startsWith("schemas/"))
            .map((ref) => decodeName(ref.slice("schemas/".length))),
        ] as const,
    ),
  );
  const refersTo = (output: string, split: ReadonlySet<string>) =>
    outputRefs.get(output)?.some((name) => split.has(name));
  const split = new Set(
    [...shared].filter(
      (output) =>
        canonical(renameSchemaRefs(schemas[output], asInput)) !==
        canonical(schemas[inputName(output)]),
    ),
  );
  let previousSize: number;
  do {
    previousSize = split.size;
    for (const output of shared) {
      if (!split.has(output) && refersTo(output, split)) {
        split.add(output);
      }
    }
  } while (split.size !== previousSize);

  // Names already taken: request components, and response components no
  // request shares, which keep their own name.
  const taken = [
    ...Object.keys(schemas).filter((name) => !isOutput(name)),
    ...outputs.filter((output) => !shared.has(output)).map(inputName),
  ];
  const outputNames = assignOutputNames([...split].toSorted(), taken);

  const rename = (name: string) =>
    isOutput(name) ? (outputNames.get(name) ?? inputName(name)) : undefined;

  return {
    components: {
      ...renameSchemaRefs(otherComponents, rename),
      schemas: Object.fromEntries(
        Object.entries(schemas).flatMap(([name, schema]) => {
          const renamed = renameSchemaRefs(schema, rename);
          if (!isOutput(name)) {
            return [[name, renamed]];
          }

          const output = outputNames.get(name);
          if (output) {
            return [[output, renamed]];
          }

          // The same shape as the request's, or no request uses the name.
          return Object.hasOwn(schemas, inputName(name))
            ? []
            : [[inputName(name), renamed]];
        }),
      ),
    } as OpenAPIV3_1.ComponentsObject,
    paths: renameSchemaRefs(paths, rename, true),
  };
};
