import type { GenericSchema, GenericSchemaAsync } from "valibot";
import { toJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";

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
  schema: T
) {
  const raw = toJsonSchema(
    // @ts-expect-error
    schema
  );

  return {};
}
