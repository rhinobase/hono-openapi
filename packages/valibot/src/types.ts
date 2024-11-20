import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import type * as v from "valibot";

export type OpenAPIVersions = "3.0.0" | "3.0.1" | "3.0.2" | "3.0.3" | "3.1.0";

export type Schema3 = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
export type Schema3_1 = OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject;

export type OpenAPI<T extends OpenAPIVersions, U, V> = T extends "3.1.0"
  ? U
  : V;
export type Schema<T extends OpenAPIVersions> = OpenAPI<T, Schema3_1, Schema3>;
export type ComponentsObject<T extends OpenAPIVersions> = Record<
  string,
  OpenAPI<T, Schema3_1, Schema3>
>;

export type ConversionConfig<T extends OpenAPIVersions> = {
  version?: T;
  components?: ComponentsObject<T>;
  errorMode?: "ignore" | "warn" | "throw";
};

export type ConversionResponse<T extends OpenAPIVersions> = {
  schema: Schema<T>;
  components?: ComponentsObject<T>;
};

/**
 * OpenAPI Schema conversion context type.
 */
export interface ConversionContext<T extends OpenAPIVersions> {
  /**
   * The OpenAPI Schema definitions.
   */
  readonly definitions: ComponentsObject<T>;
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
