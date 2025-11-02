import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as Ajv from "ajv";
import AjvFormats from "ajv-formats";
import type { InferJsonSchema, TJsonSchema } from "./inference";

// ------------------------------------------------------------------
// Internal: Ajv.ErrorObject To StandardSchemaV1.Issue
// ------------------------------------------------------------------
function pathSegments(pointer: string): string[] {
  if (pointer.length === 0) return [];
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
}
function issue(error: Ajv.ErrorObject): StandardSchemaV1.Issue {
  const path = pathSegments(error.instancePath);
  return { path, message: error.message || "unknown error" };
}
// ------------------------------------------------------------------
// TStandardJsonSchemaProps
// ------------------------------------------------------------------
export class TStandardJsonSchemaProps<Value>
  implements StandardSchemaV1.Props<Value, Value>
{
  public readonly vendor = "typebox"; // Problem: should replace with either ajv | json schema
  public readonly version = 1;
  public readonly validator: Ajv.ValidateFunction;
  constructor(schema: TJsonSchema) {
    const ajv = AjvFormats(new Ajv.Ajv());
    this.validator = ajv.compile(schema);
  }
  public validate(
    value: unknown,
  ): StandardSchemaV1.Result<Value> | Promise<StandardSchemaV1.Result<Value>> {
    if (this.validator(value)) return { value } as never;
    const errors = this.validator.errors || ([] as Ajv.ErrorObject[]);
    const issues = errors.map((error) => issue(error));
    return { issues };
  }
}
// ------------------------------------------------------------------
// TStandardJsonSchema
// ------------------------------------------------------------------
export class TStandardJsonSchema<
  JsonSchema extends TJsonSchema,
  Value = InferJsonSchema<JsonSchema>,
> implements StandardSchemaV1<Value>
{
  "~standard": StandardSchemaV1.Props<Value, Value>;
  constructor(private readonly schema: JsonSchema) {
    this["~standard"] = new TStandardJsonSchemaProps(schema);
  }
  // Problem: Leaning on the TypeBox interface here.
  public Type(): TJsonSchema {
    return this.schema;
  }
}
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Transforms a JsonSchema into a StandardSchema */
export function jsonschema<const JsonSchema extends TJsonSchema>(
  schema: JsonSchema,
): TStandardJsonSchema<JsonSchema> {
  return new TStandardJsonSchema(schema);
}
