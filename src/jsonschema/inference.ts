// Logical JSON Schema Inference System: Derived from TypeBox

// ------------------------------------------------------------------
// JSON Schema: Keywords
//
// The following keywords can be inferred as TypeScript types.
// ------------------------------------------------------------------
export type TJsonSchema = object;
export type TJsonSchemaBoolean = boolean;
export type TJsonSchemaLike = TJsonSchema | TJsonSchemaBoolean;

export interface TAdditionalProperties<
  AdditionalProperties extends TJsonSchemaLike = TJsonSchemaLike,
> {
  additionalProperties: AdditionalProperties;
}
export interface TAnyOf<AnyOf extends TJsonSchemaLike[] = TJsonSchemaLike[]> {
  anyOf: AnyOf;
}
export interface TAllOf<AllOf extends TJsonSchemaLike[] = TJsonSchemaLike[]> {
  allOf: AllOf;
}
export interface TConst<Const = unknown> {
  const: Const;
}
export interface TEnum<Enum extends unknown[] = unknown[]> {
  enum: Enum;
}
export interface TItems<
  Items extends TJsonSchemaLike | TJsonSchemaLike[] =
    | TJsonSchemaLike
    | TJsonSchemaLike[],
> {
  items: Items;
}
export interface TOneOf<OneOf extends TJsonSchemaLike[] = TJsonSchemaLike[]> {
  oneOf: OneOf;
}
export interface TPatternProperties<
  PatternProperties extends Record<PropertyKey, TJsonSchemaLike> = Record<
    PropertyKey,
    TJsonSchemaLike
  >,
> {
  patternProperties: PatternProperties;
}
export interface TPrefixItems<
  PrefixItems extends TJsonSchemaLike[] = TJsonSchemaLike[],
> {
  prefixItems: PrefixItems;
}
export interface TProperties<
  Properties extends Record<PropertyKey, TJsonSchemaLike> = Record<
    PropertyKey,
    TJsonSchemaLike
  >,
> {
  properties: Properties;
}
export interface TRequired<Required extends string[] = string[]> {
  required: Required;
}

// ------------------------------------------------------------------
// JSON Schema: Inference
//
// JSON Schema keywords can be interpreted as logical AND statements
// applied at a per-schema level. This inference strategy leans on
// this aspect and constructs a type-level AND expression for each
// observed keyword. Each AND operand is reduced to a final type
// using the InferEvaluate inference type.
//
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// AdditionalProperties
// ------------------------------------------------------------------
type InferAdditionalProperties<
  Schema extends TJsonSchemaLike,
  Result extends Record<PropertyKey, unknown> = Schema extends true
    ? { [key: string]: unknown }
    : Schema extends false
      ? {}
      : { [key: string]: InferJsonSchemaFragment<Schema> },
> = Result;
// ------------------------------------------------------------------
// AllOf
// ------------------------------------------------------------------
type InferAllOf<
  Schemas extends TJsonSchemaLike[],
  Result = unknown,
> = Schemas extends [
  infer Left extends TJsonSchemaLike,
  ...infer Right extends TJsonSchemaLike[],
]
  ? InferAllOf<Right, InferJsonSchemaFragment<Left> & Result>
  : Result;
// ------------------------------------------------------------------
// AnyOf
// ------------------------------------------------------------------
type InferAnyOf<
  Schemas extends TJsonSchemaLike[],
  Result = never,
> = Schemas extends [
  infer Left extends TJsonSchemaLike,
  ...infer Right extends TJsonSchemaLike[],
]
  ? InferAnyOf<Right, InferJsonSchemaFragment<Left> | Result>
  : Result;
// ------------------------------------------------------------------
// Const
// ------------------------------------------------------------------
type InferConst<Value> = Value;
// ------------------------------------------------------------------
// Enum
// ------------------------------------------------------------------
type InferEnum<Values extends unknown[], Result = never> = Values extends [
  infer Left,
  ...infer Right extends unknown[],
]
  ? InferEnum<Right, Left | Result>
  : Result;
// ------------------------------------------------------------------
// Items
// ------------------------------------------------------------------
type InferItemsUnsized<Schema extends TJsonSchemaLike> =
  InferJsonSchemaFragment<Schema>[];
type InferItemsSized<
  Schema extends TJsonSchemaLike[],
  Result extends unknown[] = [],
> = Schema extends [
  infer Left extends TJsonSchemaLike,
  ...infer Right extends TJsonSchemaLike[],
]
  ? InferItemsSized<Right, [...Result, InferJsonSchemaFragment<Left>]>
  : Result;
type InferItems<
  Schemas extends TJsonSchemaLike[] | TJsonSchemaLike,
  Result = Schemas extends TJsonSchemaLike[]
    ? InferItemsSized<[...Schemas]>
    : Schemas extends TJsonSchemaLike
      ? InferItemsUnsized<Schemas>
      : never,
> = Result;
// ------------------------------------------------------------------
// OneOf
// ------------------------------------------------------------------
type InferOneOf<
  Schemas extends TJsonSchemaLike[],
  Result = never,
> = Schemas extends [
  infer Left extends TJsonSchemaLike,
  ...infer Right extends TJsonSchemaLike[],
]
  ? InferOneOf<Right, InferJsonSchemaFragment<Left> | Result>
  : Result;
// ------------------------------------------------------------------
// PatternProperties
// ------------------------------------------------------------------
type InferPatternProperties<
  Properties extends Record<PropertyKey, TJsonSchemaLike> = Record<
    PropertyKey,
    TJsonSchemaLike
  >,
  InferredProperties extends Record<PropertyKey, unknown> = {
    [Key in keyof Properties]: InferJsonSchemaFragment<Properties[Key]>;
  },
  EvaluatedProperties = {
    [key: string]: InferredProperties[keyof InferredProperties];
  },
> = EvaluatedProperties;
// ------------------------------------------------------------------
// PrefixItems
// ------------------------------------------------------------------
type InferPrefixItems<
  Schemas extends TJsonSchemaLike[],
  Result extends unknown[] = [],
> = Schemas extends [
  infer Left extends TJsonSchemaLike,
  ...infer Right extends TJsonSchemaLike[],
]
  ? InferPrefixItems<Right, [...Result, InferJsonSchemaFragment<Left>]>
  : Result;
// ------------------------------------------------------------------
// Properties
// ------------------------------------------------------------------
type InferProperties<
  Properties extends Record<PropertyKey, TJsonSchemaLike>,
  Readonly extends Record<PropertyKey, unknown> = {
    readonly [Key in keyof Properties as Properties[Key] extends {
      readOnly: true;
    }
      ? Key
      : never]?: InferJsonSchemaFragment<Properties[Key]>;
  },
  Standard extends Record<PropertyKey, unknown> = {
    [Key in keyof Properties as Properties[Key] extends { readOnly: true }
      ? never
      : Key]?: InferJsonSchemaFragment<Properties[Key]>;
  },
  Result extends Record<PropertyKey, unknown> = Readonly & Standard,
> = Result;
// ------------------------------------------------------------------
// Required
// ------------------------------------------------------------------
type RequiredSelectProperty<
  Properties extends Record<PropertyKey, TJsonSchemaLike>,
  Key extends string,
  Result extends Record<PropertyKey, unknown> = Key extends keyof Properties
    ? Properties[Key] extends { readOnly: true }
      ? { readonly [_ in Key]: InferJsonSchemaFragment<Properties[Key]> }
      : { [_ in Key]: InferJsonSchemaFragment<Properties[Key]> }
    : { [_ in Key]: unknown },
> = Result;
type RequiredSelectProperties<
  Properties extends Record<PropertyKey, TJsonSchemaLike>,
  Keys extends string[],
  Result extends Record<PropertyKey, unknown> = {},
> = Keys extends [infer Left extends string, ...infer Right extends string[]]
  ? RequiredSelectProperties<
      Properties,
      Right,
      Result & RequiredSelectProperty<Properties, Left>
    >
  : Result;
type RequiredGetProperties<
  Schema extends TJsonSchemaLike,
  Result extends Record<PropertyKey, unknown> = Schema extends TProperties<
    infer Properties extends Record<PropertyKey, TJsonSchemaLike>
  >
    ? Properties
    : {},
> = Result;
type InferRequired<
  Schema extends TJsonSchemaLike,
  Keys extends string[],
  Properties extends Record<
    PropertyKey,
    TJsonSchemaLike
  > = RequiredGetProperties<Schema>,
  Result extends Record<PropertyKey, unknown> = RequiredSelectProperties<
    Properties,
    Keys
  >,
> = Result;
// ------------------------------------------------------------------
// InferKeywords
// ------------------------------------------------------------------
type InferKeywords<
  Schema,
  Result extends unknown[] = [
    Schema extends TAdditionalProperties<infer Type extends TJsonSchemaLike>
      ? InferAdditionalProperties<Type>
      : unknown,
    Schema extends TAllOf<infer Types extends TJsonSchemaLike[]>
      ? InferAllOf<Types>
      : unknown,
    Schema extends TAnyOf<infer Types extends TJsonSchemaLike[]>
      ? InferAnyOf<Types>
      : unknown,
    Schema extends TConst<infer Value> ? InferConst<Value> : unknown,
    Schema extends TEnum<infer Values extends unknown[]>
      ? InferEnum<Values>
      : unknown,
    Schema extends TItems<
      infer Types extends TJsonSchemaLike[] | TJsonSchemaLike
    >
      ? InferItems<Types>
      : unknown,
    Schema extends TOneOf<infer Types extends TJsonSchemaLike[]>
      ? InferOneOf<Types>
      : unknown,
    Schema extends TPatternProperties<
      infer Properties extends Record<PropertyKey, TJsonSchemaLike>
    >
      ? InferPatternProperties<Properties>
      : unknown,
    Schema extends TPrefixItems<infer Types extends TJsonSchemaLike[]>
      ? InferPrefixItems<Types>
      : unknown,
    Schema extends TProperties<
      infer Properties extends Record<PropertyKey, TJsonSchemaLike>
    >
      ? InferProperties<Properties>
      : unknown,
    Schema extends TRequired<infer Keys extends string[]>
      ? InferRequired<Schema, Keys>
      : unknown,
    Schema extends { type: "array" } ? {} : unknown,
    Schema extends { type: "boolean" } ? boolean : unknown,
    Schema extends { type: "integer" } ? number : unknown,
    Schema extends { type: "object" } ? object : unknown,
    Schema extends { type: "null" } ? null : unknown,
    Schema extends { type: "number" } ? number : unknown,
    Schema extends { type: "string" } ? string : unknown,
  ],
> = Result;
// ------------------------------------------------------------------
// InferKeywordIntersect
// ------------------------------------------------------------------
type InferKeywordIntersect<
  Schemas extends unknown[],
  Result = unknown,
> = Schemas extends [infer Left, ...infer Right extends unknown[]]
  ? InferKeywordIntersect<Right, Result & Left>
  : Result;
// ------------------------------------------------------------------
// InferEvaluate
// ------------------------------------------------------------------
type InferEvaluate<
  Schema,
  Result = Schema extends object
    ? { [Key in keyof Schema]: Schema[Key] }
    : Schema,
> = Result;
// ------------------------------------------------------------------
// InferJsonSchemaFragment
// ------------------------------------------------------------------
type InferJsonSchemaFragment<
  Schema,
  Keywords extends unknown[] = InferKeywords<Schema>,
  Intersect = InferKeywordIntersect<Keywords>,
  Result = InferEvaluate<Intersect>,
> = Result;
// ------------------------------------------------------------------
// InferMutable
// ------------------------------------------------------------------
type InferMutableTuple<Schemas extends readonly unknown[]> = Schemas extends [
  infer Left,
  ...infer Right extends unknown[],
]
  ? [InferMutable<Left>, ...InferMutableTuple<Right>]
  : [];
type InferMutableArray<
  Schema,
  Result extends unknown[] = InferMutable<Schema>[],
> = Result;
type InferMutableObject<
  Schema extends object,
  Result extends Record<PropertyKey, unknown> = {
    -readonly [K in keyof Schema]: InferMutable<Schema[K]>;
  },
> = Result;
type InferMutable<Schema> = Schema extends readonly [
  ...infer Schemas extends unknown[],
]
  ? InferMutableTuple<Schemas>
  : Schema extends readonly (infer Schema)[]
    ? InferMutableArray<Schema>
    : Schema extends object
      ? InferMutableObject<Schema>
      : Schema;
// ------------------------------------------------------------------
// InferJsonSchema
// ------------------------------------------------------------------
/** Infers a JsonSchema schematic as a TypeScript type. */
export type InferJsonSchema<
  Schema extends TJsonSchemaLike,
  Mutable extends TJsonSchemaLike = InferMutable<Schema>,
  Result = InferJsonSchemaFragment<Mutable>,
> = Result;
