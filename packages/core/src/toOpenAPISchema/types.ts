import type {
  JSONSchema,
  ParserOptions,
} from "@apidevtools/json-schema-ref-parser";

export type addPrefixToObject = {
  [K in keyof JSONSchema as `x-${K}`]: JSONSchema[K];
};

export interface Options {
  cloneSchema?: boolean;
  dereference?: boolean;
  convertUnreferencedDefinitions?: boolean;
  dereferenceOptions?: ParserOptions | undefined;
}
type ExtendedJSONSchema = addPrefixToObject & JSONSchema;
export type SchemaType = ExtendedJSONSchema & {
  example?: JSONSchema["examples"][number];
  "x-patternProperties"?: JSONSchema["patternProperties"];
  nullable?: boolean;
};
export type SchemaTypeKeys = keyof SchemaType;
