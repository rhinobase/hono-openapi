import type { JSONSchema7 } from "json-schema";
import type { OpenAPIV3_1 } from "openapi-types";
import type { McpTool, OpenApiToMcpOptions } from "./types.js";

const DEFAULT_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/**
 * Convert an OpenAPI specification to MCP tools.
 *
 * Each OpenAPI operation is converted to an MCP tool where:
 * - `operationId` becomes the tool name
 * - `summary` or `description` becomes the tool description
 * - Request body and parameters become the input schema
 * - Response schema optionally becomes the output schema
 *
 * @param spec - OpenAPI 3.1 specification document
 * @param options - Conversion options
 * @returns Array of MCP tools
 *
 * @example
 * ```typescript
 * import { generateSpecs } from "hono-openapi";
 * import { createMcpFromOpenApiSpec } from "hono-openapi/mcp";
 *
 * const openApiSpec = await generateSpecs(app);
 * const tools = createMcpFromOpenApiSpec(openApiSpec, {
 *   includeTags: ["public"],
 *   includeOutputSchemas: true
 * });
 * ```
 */
export function createMcpFromOpenApiSpec(
  spec: OpenAPIV3_1.Document,
  options: OpenApiToMcpOptions = {},
): McpTool[] {
  const {
    includeTags,
    excludeTags,
    includePaths,
    excludePaths,
    includeMethods = DEFAULT_METHODS,
    toolNameGenerator,
    includeOutputSchemas = false,
  } = options;

  const tools: McpTool[] = [];

  if (!spec.paths) {
    return tools;
  }

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem) continue;

    // Check path filters
    if (includePaths?.length && !matchesPatterns(path, includePaths)) {
      continue;
    }
    if (excludePaths?.length && matchesPatterns(path, excludePaths)) {
      continue;
    }

    // Process each HTTP method
    for (const method of Object.keys(pathItem)) {
      const upperMethod = method.toUpperCase();

      // Skip non-operation properties
      if (!includeMethods.includes(upperMethod)) {
        continue;
      }

      const operation = pathItem[method as keyof OpenAPIV3_1.PathItemObject];
      if (!isOperation(operation)) {
        continue;
      }

      // Check tag filters
      if (includeTags?.length) {
        const hasIncludedTag = operation.tags?.some((tag) =>
          includeTags.includes(tag),
        );
        if (!hasIncludedTag) continue;
      }
      if (excludeTags?.length) {
        const hasExcludedTag = operation.tags?.some((tag) =>
          excludeTags.includes(tag),
        );
        if (hasExcludedTag) continue;
      }

      // Generate tool name
      const name = toolNameGenerator
        ? toolNameGenerator(operation.operationId || "", method, path)
        : operation.operationId || generateDefaultName(method, path);

      // Build input schema from parameters and request body
      const inputSchema = buildInputSchema(
        operation,
        pathItem,
        spec.components,
      );

      // Optionally build output schema from responses
      const outputSchema = includeOutputSchemas
        ? buildOutputSchema(operation, spec.components)
        : undefined;

      tools.push({
        name,
        title: operation.summary,
        description: operation.description || operation.summary,
        inputSchema,
        outputSchema,
      });
    }
  }

  return tools;
}

/**
 * Check if a path matches any of the given patterns
 */
function matchesPatterns(path: string, patterns: (string | RegExp)[]): boolean {
  return patterns.some((pattern) => {
    if (typeof pattern === "string") {
      return path === pattern || path.startsWith(pattern);
    }
    return pattern.test(path);
  });
}

/**
 * Type guard for OpenAPI operation
 */
function isOperation(value: unknown): value is OpenAPIV3_1.OperationObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    ("responses" in value || "operationId" in value || "tags" in value)
  );
}

/**
 * Generate a default tool name from method and path
 */
function generateDefaultName(method: string, path: string): string {
  const pathPart = path
    .replace(/^\//, "")
    .replace(/\{([^}]+)\}/g, "by_$1")
    .replace(/\//g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/_$/, "");

  return `${method.toLowerCase()}_${pathPart || "index"}`;
}

/**
 * Build input schema from OpenAPI operation parameters and request body
 */
function buildInputSchema(
  operation: OpenAPIV3_1.OperationObject,
  pathItem: OpenAPIV3_1.PathItemObject,
  components?: OpenAPIV3_1.ComponentsObject,
): JSONSchema7 {
  const properties: Record<string, JSONSchema7> = {};
  const required: string[] = [];

  // Process path-level parameters
  if (pathItem.parameters) {
    processParameters(pathItem.parameters, properties, required, components);
  }

  // Process operation-level parameters
  if (operation.parameters) {
    processParameters(operation.parameters, properties, required, components);
  }

  // Process request body
  if (operation.requestBody) {
    const requestBody = resolveRef(
      operation.requestBody,
      components,
    ) as OpenAPIV3_1.RequestBodyObject;

    if (requestBody?.content) {
      // Prefer JSON content type
      const jsonContent =
        requestBody.content["application/json"] ||
        requestBody.content["application/x-www-form-urlencoded"] ||
        Object.values(requestBody.content)[0];

      if (jsonContent?.schema) {
        const bodySchema = resolveRef(
          jsonContent.schema,
          components,
        ) as OpenAPIV3_1.SchemaObject;

        // If body has properties, merge them
        if (bodySchema?.properties) {
          for (const [key, value] of Object.entries(bodySchema.properties)) {
            properties[key] = convertToJsonSchema7(
              resolveRef(value, components) as OpenAPIV3_1.SchemaObject,
            );
          }
          if (bodySchema.required) {
            required.push(...bodySchema.required);
          }
        } else {
          // Otherwise, add as "body" property
          properties.body = convertToJsonSchema7(bodySchema);
          if (requestBody.required) {
            required.push("body");
          }
        }
      }
    }
  }

  const schema: JSONSchema7 = {
    type: "object",
    properties,
  };

  if (required.length > 0) {
    schema.required = [...new Set(required)];
  }

  return schema;
}

/**
 * Process OpenAPI parameters into JSON Schema properties
 */
function processParameters(
  parameters: (OpenAPIV3_1.ParameterObject | OpenAPIV3_1.ReferenceObject)[],
  properties: Record<string, JSONSchema7>,
  required: string[],
  components?: OpenAPIV3_1.ComponentsObject,
): void {
  for (const param of parameters) {
    const resolved = resolveRef(
      param,
      components,
    ) as OpenAPIV3_1.ParameterObject;
    if (!resolved) continue;

    const paramSchema = resolved.schema
      ? (resolveRef(resolved.schema, components) as OpenAPIV3_1.SchemaObject)
      : { type: "string" as const };

    properties[resolved.name] = {
      ...convertToJsonSchema7(paramSchema),
      description: resolved.description || paramSchema.description,
    };

    if (resolved.required) {
      required.push(resolved.name);
    }
  }
}

/**
 * Build output schema from OpenAPI operation responses
 */
function buildOutputSchema(
  operation: OpenAPIV3_1.OperationObject,
  components?: OpenAPIV3_1.ComponentsObject,
): JSONSchema7 | undefined {
  if (!operation.responses) {
    return undefined;
  }

  // Get the success response (2xx)
  const successResponse =
    operation.responses["200"] ||
    operation.responses["201"] ||
    operation.responses.default;

  if (!successResponse) {
    return undefined;
  }

  const resolved = resolveRef(
    successResponse,
    components,
  ) as OpenAPIV3_1.ResponseObject;

  if (!resolved?.content) {
    return undefined;
  }

  const jsonContent =
    resolved.content["application/json"] || Object.values(resolved.content)[0];

  if (!jsonContent?.schema) {
    return undefined;
  }

  const schema = resolveRef(
    jsonContent.schema,
    components,
  ) as OpenAPIV3_1.SchemaObject;

  return convertToJsonSchema7(schema);
}

/**
 * Resolve a reference object to its actual value
 */
function resolveRef<T>(
  value: T | OpenAPIV3_1.ReferenceObject,
  components?: OpenAPIV3_1.ComponentsObject,
): T | undefined {
  if (!value) return undefined;

  if (isReferenceObject(value)) {
    const refPath = value.$ref.replace(/^#\/components\//, "").split("/");
    let resolved: unknown = components;

    for (const part of refPath) {
      if (resolved && typeof resolved === "object") {
        resolved = (resolved as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return resolved as T;
  }

  return value;
}

/**
 * Type guard for reference objects
 */
function isReferenceObject(
  value: unknown,
): value is OpenAPIV3_1.ReferenceObject {
  return (
    typeof value === "object" &&
    value !== null &&
    "$ref" in value &&
    typeof (value as { $ref: unknown }).$ref === "string"
  );
}

/**
 * Convert OpenAPI Schema to JSON Schema 7
 */
function convertToJsonSchema7(schema: OpenAPIV3_1.SchemaObject): JSONSchema7 {
  if (!schema) {
    return {};
  }

  const result: JSONSchema7 = {};

  // Copy basic properties
  if (schema.type) result.type = schema.type as JSONSchema7["type"];
  if (schema.description) result.description = schema.description;
  if (schema.enum) result.enum = schema.enum;
  if (schema.default !== undefined) result.default = schema.default;
  if (schema.format) result.format = schema.format;

  // Number constraints
  if (schema.minimum !== undefined) result.minimum = schema.minimum;
  if (schema.maximum !== undefined) result.maximum = schema.maximum;
  if (schema.exclusiveMinimum !== undefined)
    result.exclusiveMinimum = schema.exclusiveMinimum;
  if (schema.exclusiveMaximum !== undefined)
    result.exclusiveMaximum = schema.exclusiveMaximum;
  if (schema.multipleOf !== undefined) result.multipleOf = schema.multipleOf;

  // String constraints
  if (schema.minLength !== undefined) result.minLength = schema.minLength;
  if (schema.maxLength !== undefined) result.maxLength = schema.maxLength;
  if (schema.pattern) result.pattern = schema.pattern;

  // Array constraints
  if (schema.items) {
    result.items = convertToJsonSchema7(
      schema.items as OpenAPIV3_1.SchemaObject,
    );
  }
  if (schema.minItems !== undefined) result.minItems = schema.minItems;
  if (schema.maxItems !== undefined) result.maxItems = schema.maxItems;
  if (schema.uniqueItems !== undefined) result.uniqueItems = schema.uniqueItems;

  // Object constraints
  if (schema.properties) {
    result.properties = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      result.properties[key] = convertToJsonSchema7(
        value as OpenAPIV3_1.SchemaObject,
      );
    }
  }
  if (schema.required) result.required = schema.required;
  if (schema.additionalProperties !== undefined) {
    result.additionalProperties =
      typeof schema.additionalProperties === "object"
        ? convertToJsonSchema7(
            schema.additionalProperties as OpenAPIV3_1.SchemaObject,
          )
        : schema.additionalProperties;
  }

  // Composition
  if (schema.allOf) {
    result.allOf = schema.allOf.map((s) =>
      convertToJsonSchema7(s as OpenAPIV3_1.SchemaObject),
    );
  }
  if (schema.anyOf) {
    result.anyOf = schema.anyOf.map((s) =>
      convertToJsonSchema7(s as OpenAPIV3_1.SchemaObject),
    );
  }
  if (schema.oneOf) {
    result.oneOf = schema.oneOf.map((s) =>
      convertToJsonSchema7(s as OpenAPIV3_1.SchemaObject),
    );
  }

  return result;
}
