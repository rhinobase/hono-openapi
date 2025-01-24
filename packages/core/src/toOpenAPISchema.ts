import type {
  JSONSchema,
  ParserOptions,
} from "@apidevtools/json-schema-ref-parser";
import type {
  JSONSchema4,
  JSONSchema6Definition,
  JSONSchema7Definition,
} from "json-schema";
import { Walker } from "json-schema-walker";
import type { OpenAPIV3 } from "openapi-types";

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

const allowedKeywords = [
  "$ref",
  "definitions",
  // From Schema
  "title",
  "multipleOf",
  "maximum",
  "exclusiveMaximum",
  "minimum",
  "exclusiveMinimum",
  "maxLength",
  "minLength",
  "pattern",
  "maxItems",
  "minItems",
  "uniqueItems",
  "maxProperties",
  "minProperties",
  "required",
  "enum",
  "type",
  "not",
  "allOf",
  "oneOf",
  "anyOf",
  "items",
  "properties",
  "additionalProperties",
  "description",
  "format",
  "default",
  "nullable",
  "discriminator",
  "readOnly",
  "writeOnly",
  "example",
  "externalDocs",
  "deprecated",
  "xml",
];

class InvalidTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTypeError";
    this.message = message;
  }
}

const oasExtensionPrefix = "x-";

const handleDefinition = async <T extends JSONSchema4 = JSONSchema4>(
  def: JSONSchema7Definition | JSONSchema6Definition | JSONSchema4,
  schema: T,
) => {
  if (typeof def !== "object") {
    return def;
  }

  const type = def.type;
  if (type) {
    // Walk just the definitions types
    const walker = new Walker<T>();
    await walker.loadSchema(
      {
        definitions: schema.definitions || [],
        ...def,
        $schema: schema.$schema,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      } as any,
      {
        dereference: true,
        cloneSchema: true,
        dereferenceOptions: {
          dereference: {
            circular: "ignore",
          },
        },
      },
    );
    await walker.walk(convertSchema, walker.vocabularies.DRAFT_07);
    if ("definitions" in walker.rootSchema) {
      walker.rootSchema.definitions = undefined;
    }
    return walker.rootSchema;
  }
  if (Array.isArray(def)) {
    // if it's an array, we might want to reconstruct the type;
    const typeArr = def;
    const hasNull = typeArr.includes("null");
    if (hasNull) {
      const actualTypes = typeArr.filter((l) => l !== "null");
      return {
        type: actualTypes.length === 1 ? actualTypes[0] : actualTypes,
        nullable: true,
        // this is incorrect but thats ok, we are in the inbetween phase here
      } as JSONSchema7Definition | JSONSchema6Definition | JSONSchema4;
    }
  }

  return def;
};

const convert = async <T extends object = JSONSchema4>(
  schema: T,
  options?: Options,
): Promise<OpenAPIV3.Document> => {
  const walker = new Walker<T>();
  const convertDefs = options?.convertUnreferencedDefinitions ?? true;
  await walker.loadSchema(schema, options);
  await walker.walk(convertSchema, walker.vocabularies.DRAFT_07);
  // if we want to convert unreferenced definitions, we need to do it iteratively here
  const rootSchema = walker.rootSchema as unknown as JSONSchema;
  if (convertDefs && rootSchema?.definitions) {
    for (const defName in rootSchema.definitions) {
      const def = rootSchema.definitions[defName];
      rootSchema.definitions[defName] = await handleDefinition(def, schema);
    }
  }
  return rootSchema as OpenAPIV3.Document;
};

function stripIllegalKeywords(schema: SchemaType) {
  if (typeof schema !== "object") {
    return schema;
  }
  schema.$schema = undefined;
  schema.$id = undefined;
  if ("id" in schema) {
    schema.id = undefined;
  }
  return schema;
}

function convertSchema(schema?: SchemaType) {
  let _schema = schema;

  if (!_schema) {
    return _schema;
  }

  _schema = stripIllegalKeywords(_schema);
  _schema = convertTypes(_schema);
  _schema = rewriteConst(_schema);
  _schema = convertDependencies(_schema);
  _schema = convertNullable(_schema);
  _schema = rewriteIfThenElse(_schema);
  _schema = rewriteExclusiveMinMax(_schema);
  _schema = convertExamples(_schema);

  if (typeof _schema.patternProperties === "object") {
    _schema = convertPatternProperties(_schema);
  }

  if (_schema.type === "array" && typeof _schema.items === "undefined") {
    _schema.items = {};
  }

  // should be called last
  _schema = convertIllegalKeywordsAsExtensions(_schema);
  return _schema;
}

const validTypes = new Set([
  "null",
  "boolean",
  "object",
  "array",
  "number",
  "string",
  "integer",
]);

function validateType(type: unknown) {
  if (typeof type === "object" && !Array.isArray(type)) {
    // Refs are allowed because they fix circular references
    if (type && "$ref" in type && type.$ref) {
      return;
    }
    // this is a de-referenced circular ref
    if (type && "properties" in type && type.properties) {
      return;
    }
  }
  const types = Array.isArray(type) ? type : [type];

  for (const type of types) {
    if (type && !validTypes.has(type))
      throw new InvalidTypeError(`Type "${type}" is not a valid type`);
  }
}

function convertDependencies(schema: SchemaType) {
  const deps = schema.dependencies;
  if (typeof deps !== "object") {
    return schema;
  }

  // Turns the dependencies keyword into an allOf of oneOf's
  // "dependencies": {
  // 		"post-office-box": ["street-address"]
  // },
  //
  // becomes
  //
  // "allOf": [
  // 	{
  // 		"oneOf": [
  // 			{"not": {"required": ["post-office-box"]}},
  // 			{"required": ["post-office-box", "street-address"]}
  // 		]
  // 	}
  //

  schema.dependencies = undefined;
  if (!Array.isArray(schema.allOf)) {
    schema.allOf = [];
  }

  for (const key in deps) {
    const foo: (JSONSchema4 & JSONSchema6Definition) & JSONSchema7Definition = {
      oneOf: [
        {
          not: {
            required: [key],
          },
        },
        {
          required: [key, deps[key]].flat() as string[],
        },
      ],
    };
    schema.allOf.push(foo);
  }
  return schema;
}

function convertNullable(schema: SchemaType) {
  for (const key of ["oneOf", "anyOf"] as const) {
    const schemas = schema[key] as JSONSchema4[];
    if (!schemas) continue;

    if (!Array.isArray(schemas)) {
      return schema;
    }

    const hasNullable = schemas.some((item) => item.type === "null");

    if (!hasNullable) {
      return schema;
    }

    const filtered = schemas.filter((l) => l.type !== "null");
    for (const schemaEntry of filtered) {
      schemaEntry.nullable = true;
    }

    schema[key] = filtered;
  }

  return schema;
}

function convertTypes(schema: SchemaType) {
  if (typeof schema !== "object") {
    return schema;
  }
  if (schema.type === undefined) {
    return schema;
  }

  validateType(schema.type);

  if (Array.isArray(schema.type)) {
    if (schema.type.includes("null")) {
      schema.nullable = true;
    }
    const typesWithoutNull = schema.type.filter((type) => type !== "null");
    if (typesWithoutNull.length === 0) {
      schema.type = undefined;
    } else if (typesWithoutNull.length === 1) {
      schema.type = typesWithoutNull[0];
    } else {
      schema.type = undefined;
      schema.anyOf = typesWithoutNull.map((type) => ({ type }));
    }
  } else if (schema.type === "null") {
    schema.type = undefined;
    schema.nullable = true;
  }

  return schema;
}

// "patternProperties did not make it into OpenAPI v3.0"
// https://github.com/OAI/OpenAPI-Specification/issues/687
function convertPatternProperties(schema: SchemaType) {
  schema["x-patternProperties"] = schema.patternProperties;
  schema.patternProperties = undefined;
  schema.additionalProperties ??= true;
  return schema;
}

// keywords (or property names) that are not recognized within OAS3 are rewritten into extensions.
function convertIllegalKeywordsAsExtensions(schema: SchemaType) {
  const keys = Object.keys(schema) as SchemaTypeKeys[];

  for (const keyword of keys) {
    if (
      !keyword.startsWith(oasExtensionPrefix) &&
      !allowedKeywords.includes(keyword)
    ) {
      const key = `${oasExtensionPrefix}${keyword}` as keyof SchemaType;
      schema[key] = schema[keyword];
      schema[keyword] = undefined;
    }
  }

  return schema;
}

function convertExamples(schema: SchemaType) {
  if (schema.examples && Array.isArray(schema.examples)) {
    schema.example = schema.examples[0];
    schema.examples = undefined;
  }

  return schema;
}

function rewriteConst(schema: SchemaType) {
  if (!Object.hasOwnProperty.call(schema, "enum") && Object.hasOwnProperty.call(schema, "const")) {
    schema.enum = [schema.const];
    schema.const = undefined;
  }
  return schema;
}

function rewriteIfThenElse(schema: SchemaType) {
  if (typeof schema !== "object") {
    return schema;
  }
  /* @handrews https://github.com/OAI/OpenAPI-Specification/pull/1766#issuecomment-442652805
  if and the *Of keywords

  There is a really easy solution for implementations, which is that

  if: X, then: Y, else: Z

  is equivalent to

  oneOf: [allOf: [X, Y], allOf: [not: X, Z]]
  */
  if ("if" in schema && schema.if && schema.then) {
    schema.oneOf = [
      { allOf: [schema.if, schema.then].filter(Boolean) },
      { allOf: [{ not: schema.if }, schema.else].filter(Boolean) },
    ];
    schema.if = undefined;
    // biome-ignore lint/suspicious/noThenProperty: <explanation>
    schema.then = undefined;
    schema.else = undefined;
  }
  return schema;
}

function rewriteExclusiveMinMax(schema: SchemaType) {
  if (typeof schema.exclusiveMaximum === "number") {
    schema.maximum = schema.exclusiveMaximum;
    (schema as JSONSchema4).exclusiveMaximum = true;
  }
  if (typeof schema.exclusiveMinimum === "number") {
    schema.minimum = schema.exclusiveMinimum;
    (schema as JSONSchema4).exclusiveMinimum = true;
  }
  return schema;
}

export default convert;
