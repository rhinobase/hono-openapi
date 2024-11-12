import type { GenericSchema, GenericSchemaAsync } from "valibot";
import * as v from "valibot";
import type {
  ConversionContext,
  ConversionConfig,
  ConversionResponse,
} from "./types";
import { convertSchema } from "./convertSchema";

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

/**
 * Converts a Valibot schema to the OpenAPI Schema format.
 *
 * @param schema The Valibot schema object.
 * @param config The OpenAPI Schema configuration.
 *
 * @returns The converted OpenAPI Schema.
 */
export function createSchema<T extends GenericSchema | GenericSchemaAsync>(
  schema: T,
  config?: ConversionConfig
): ConversionResponse {
  // Initialize JSON Schema context
  const context: ConversionContext = {
    definitions: {},
    referenceMap: new Map(),
    getterMap: new Map(),
  };

  const openAPISchema = convertSchema({}, schema, config, context);

  return openAPISchema;
}
