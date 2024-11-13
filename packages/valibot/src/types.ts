import type { OpenAPIV3 } from "openapi-types";
import type * as v from "valibot";

export type ConversionConfig = {
  version: "3.0.0" | "3.0.1" | "3.0.2" | "3.0.3" | "3.1.0";
  components: OpenAPIV3.ComponentsObject["schemas"];
  errorMode?: "ignore" | "warn" | "throw";
};

export type ConversionResponse = {
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
  components?: OpenAPIV3.ComponentsObject["schemas"];
};

/**
 * OpenAPI Schema conversion context type.
 */
export interface ConversionContext {
  /**
   * The OpenAPI Schema definitions.
   */
  readonly definitions: Record<
    string,
    OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  >;
  /**
   * The OpenAPI Schema reference map.
   */
  readonly referenceMap: Map<
    v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
    string
  >;
  /**
   * The lazy schema getter map.
   */
  readonly getterMap: Map<
    (input: unknown) => v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
    v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>
  >;
}
