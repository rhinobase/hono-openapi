import type { GenericSchema, GenericSchemaAsync } from "valibot";
import { toJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";
import type { OpenAPIRouteHandlerConfig } from "./types";
import type { OpenAPIV3 } from "openapi-types";

export type OpenAPIMetadata<T = string> = {
  description: string;
  example: T;
  examples: [T, ...T[]];
  default: T;
  ref: string;
};

export const metadata = <
  TInput,
  TMetadata extends Partial<OpenAPIMetadata<TInput>>
>(
  metadata: TMetadata
) => v.metadata<TInput, TMetadata>(metadata);

export function createSchema<T extends GenericSchema | GenericSchemaAsync>(
  schema: T,
  options?: OpenAPIRouteHandlerConfig
) {
  const raw = toJsonSchema(
    // @ts-expect-error
    schema
  );

  return { schema: convertJSONSchemaToOpenAPI(raw), components: {} };
}

function convertJSONSchemaToOpenAPI(schema: ReturnType<typeof toJsonSchema>) {
  const convertedSchema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject =
    {};

  // Directly map core attributes
  if (schema.title) convertedSchema.title = schema.title;
  if (schema.type) convertedSchema.type = schema.type;
  if (schema.format) convertedSchema.format = schema.format;
  if (schema.enum) convertedSchema.enum = schema.enum;

  // Handle "nullable" conversion
  if (schema.type?.includes("null")) {
    convertedSchema.type = schema.type === "null" ? "string" : schema.type;
    convertedSchema.nullable = true;
  }

  // Map properties recursively if the type is "object"
  if (schema.type === "object" && schema.properties) {
    convertedSchema.type = "object";
    convertedSchema.properties = {};

    for (const [key, value] of Object.entries(schema.properties)) {
      convertedSchema.properties[key] = convertJSONSchemaToOpenAPI(value);
    }
  }

  // Map items if the type is "array"
  if (schema.type === "array" && schema.items) {
    convertedSchema.type = "array";
    convertedSchema.items = convertJSONSchemaToOpenAPI(schema.items);
  }

  // Map required fields
  if (schema.required) {
    convertedSchema.required = schema.required;
  }

  // Map example
  if (schema.examples && schema.examples.length > 0) {
    convertedSchema.example = schema.examples[0];
  } else if (schema.example) {
    convertedSchema.example = schema.example;
  }

  // Additional OpenAPI-only attributes
  // Add other OpenAPI attributes as needed, e.g., `description`, `default`, etc.
  if (schema.description) {
    convertedSchema.description = schema.description;
  }
  if (schema.default !== undefined) {
    convertedSchema.default = schema.default;
  }

  return convertedSchema;
}
