import type {
  ConversionConfig,
  ConversionContext,
  OpenAPIVersions,
  Schema as OpenAPISchema,
  OpenAPI,
} from "./types";
import * as v from "valibot";
import { handleError } from "./utils";
import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { convertAction } from "./convertAction";

/**
 * Schema type.
 */
type Schema =
  | v.AnySchema
  | v.UnknownSchema
  | v.NullableSchema<
      v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
      v.Default<v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>, null>
    >
  | v.NullishSchema<
      v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
      v.Default<
        v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
        null | undefined
      >
    >
  | v.NullSchema<v.ErrorMessage<v.NullIssue> | undefined>
  | v.StringSchema<v.ErrorMessage<v.StringIssue> | undefined>
  | v.BooleanSchema<v.ErrorMessage<v.BooleanIssue> | undefined>
  | v.NumberSchema<v.ErrorMessage<v.NumberIssue> | undefined>
  | v.LiteralSchema<v.Literal, v.ErrorMessage<v.LiteralIssue> | undefined>
  | v.PicklistSchema<
      v.PicklistOptions,
      v.ErrorMessage<v.PicklistIssue> | undefined
    >
  | v.EnumSchema<v.Enum, v.ErrorMessage<v.EnumIssue> | undefined>
  | v.VariantSchema<
      string,
      v.VariantOptions<string>,
      v.ErrorMessage<v.VariantIssue> | undefined
    >
  | v.UnionSchema<
      v.UnionOptions,
      v.ErrorMessage<v.UnionIssue<v.BaseIssue<unknown>>> | undefined
    >
  | v.IntersectSchema<
      v.IntersectOptions,
      v.ErrorMessage<v.IntersectIssue> | undefined
    >
  | v.ObjectSchema<v.ObjectEntries, v.ErrorMessage<v.ObjectIssue> | undefined>
  | v.ObjectWithRestSchema<
      v.ObjectEntries,
      v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
      v.ErrorMessage<v.ObjectWithRestIssue> | undefined
    >
  | v.OptionalSchema<
      v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
      v.Default<v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>, undefined>
    >
  | v.UndefinedableSchema<
      v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
      v.Default<v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>, undefined>
    >
  | v.StrictObjectSchema<
      v.ObjectEntries,
      v.ErrorMessage<v.StrictObjectIssue> | undefined
    >
  | v.LooseObjectSchema<
      v.ObjectEntries,
      v.ErrorMessage<v.LooseObjectIssue> | undefined
    >
  | v.RecordSchema<
      v.BaseSchema<string, string | number | symbol, v.BaseIssue<unknown>>,
      v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
      v.ErrorMessage<v.RecordIssue> | undefined
    >
  | v.TupleSchema<v.TupleItems, v.ErrorMessage<v.TupleIssue> | undefined>
  | v.TupleWithRestSchema<
      v.TupleItems,
      v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
      v.ErrorMessage<v.TupleWithRestIssue> | undefined
    >
  | v.LooseTupleSchema<
      v.TupleItems,
      v.ErrorMessage<v.LooseTupleIssue> | undefined
    >
  | v.StrictTupleSchema<
      v.TupleItems,
      v.ErrorMessage<v.StrictTupleIssue> | undefined
    >
  | v.ArraySchema<
      v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
      v.ErrorMessage<v.ArrayIssue> | undefined
    >
  | v.LazySchema<v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>
  | v.DateSchema<v.ErrorMessage<v.DateIssue> | undefined>;

/**
 * Schema or pipe type.
 */
type SchemaOrPipe =
  | Schema
  | v.SchemaWithPipe<
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      [Schema, ...(Schema | v.PipeAction<any, any, v.BaseIssue<unknown>>)[]]
    >;

// Create global reference count
let refCount = 0;

/**
 * Converts any supported Valibot schema to the OpenAPI Schema format.
 *
 * @param apiSchema The OpenAPI Schema object.
 * @param valibotSchema The Valibot schema object.
 * @param config The conversion configuration.
 * @param context The conversion context.
 *
 * @returns The converted OpenAPI Schema.
 */
export function convertSchema<T extends OpenAPIVersions>(
  _apiSchema: OpenAPISchema<T>,
  valibotSchema: SchemaOrPipe,
  config: ConversionConfig<T> | undefined,
  context: ConversionContext<T>
): OpenAPISchema<T> {
  let apiSchema = _apiSchema;

  // If schema is in reference map, use reference and skip conversion
  const referenceId = context.referenceMap.get(valibotSchema);
  if (referenceId && referenceId in context.definitions) {
    return {
      $ref: `#/components/schemas/${referenceId}`,
    };
  }

  // If it is schema with pipe, convert each item of pipe
  if ("pipe" in valibotSchema) {
    for (let index = 0; index < valibotSchema.pipe.length; index++) {
      // Get current pipe item
      const valibotPipeItem = valibotSchema.pipe[index];

      if (valibotPipeItem.kind === "schema") {
        // If pipe has multiple schemas, throw or warn
        if (index > 0) {
          handleError(
            'A "pipe" with multiple schemas cannot be converted to JSON Schema.',
            config
          );
        }

        // Otherwiese, convert Valibot schema to JSON Schema
        const tempJsonSchema = convertSchema(
          {},
          valibotPipeItem,
          config,
          context
        );

        // If temporary JSON Schema object is just a reference, merge its
        // definition into JSON Schema object
        if ("$ref" in tempJsonSchema) {
          // Hint: If the temporary JSON Schema is only a reference, we must
          // merge its definition into the JSON Schema object, since subsequent
          // pipe elements may modify it, which can result in an invalid JSON
          // Schema output.
          const referenceId = tempJsonSchema.$ref.split("/")[2];
          Object.assign(apiSchema, context.definitions[referenceId]);

          // Otherwise, merge temporary JSON Schema into JSON Schema object
        } else {
          Object.assign(apiSchema, tempJsonSchema);
        }

        // Otherwise, convert Valibot action to JSON Schema
      } else {
        // @ts-expect-error
        convertAction(apiSchema, valibotPipeItem, config);
      }
    }

    // Return converted JSON Schema
    return apiSchema;
  }

  // Otherwise, convert individual schema to JSON Schema
  if (!("$ref" in apiSchema)) {
    if ("fallback" in valibotSchema) {
      apiSchema.default = valibotSchema.fallback;
    }

    switch (valibotSchema.type) {
      // Primitive schemas

      case "boolean": {
        apiSchema.type = "boolean";
        break;
      }

      case "null": {
        if (isOpenAPIv3(apiSchema, config)) apiSchema.nullable = true;
        else apiSchema.type = "null";
        break;
      }

      case "number": {
        apiSchema.type = "number";
        break;
      }

      case "date":
      case "string": {
        apiSchema.type = "string";

        if (valibotSchema.type === "date") {
          apiSchema.format = "date";
        }

        break;
      }

      // Complex schemas

      case "array": {
        apiSchema = {
          ...apiSchema,
          type: "array",
          items: convertSchema(
            {},
            valibotSchema.item as SchemaOrPipe,
            config,
            context
          ),
        };
        break;
      }

      case "tuple":
      case "tuple_with_rest":
      case "loose_tuple":
      case "strict_tuple": {
        apiSchema.type = "array";

        // Add OpenAPI Schema of items
        const items: {
          oneOf: (
            | OpenAPIV3_1.ArraySchemaObject["items"]
            | OpenAPIV3.ArraySchemaObject["items"]
          )[];
        } = { oneOf: [] };
        for (const item of valibotSchema.items) {
          items.oneOf.push(
            convertSchema({}, item as SchemaOrPipe, config, context)
          );
        }

        let additionalProperties: OpenAPI<
          T,
          OpenAPIV3_1.ArraySchemaObject["additionalProperties"],
          OpenAPIV3.ArraySchemaObject["additionalProperties"]
        >;

        // Add additional items depending on schema type
        if (valibotSchema.type === "tuple_with_rest") {
          additionalProperties = convertSchema(
            {},
            valibotSchema.rest as SchemaOrPipe,
            config,
            context
          );
        } else {
          additionalProperties = valibotSchema.type === "loose_tuple";
        }

        apiSchema = {
          ...apiSchema,
          type: "array",
          items,
          ...(additionalProperties ? { additionalProperties } : {}),
        };

        break;
      }

      case "object":
      case "object_with_rest":
      case "loose_object":
      case "strict_object": {
        apiSchema.type = "object";

        // Add JSON Schema of properties and mark required keys
        apiSchema.properties = {};
        apiSchema.required = [];
        for (const key in valibotSchema.entries) {
          const entry = valibotSchema.entries[key] as SchemaOrPipe;
          apiSchema.properties[key] = convertSchema({}, entry, config, context);
          if (entry.type !== "nullish" && entry.type !== "optional") {
            apiSchema.required.push(key);
          }
        }

        // Add additional properties depending on schema type
        if (valibotSchema.type === "object_with_rest") {
          apiSchema.additionalProperties = convertSchema(
            {},
            valibotSchema.rest as SchemaOrPipe,
            config,
            context
          );
        } else if (valibotSchema.type === "loose_object") {
          apiSchema.additionalProperties = true;
        }

        break;
      }

      case "record": {
        if ("pipe" in valibotSchema.key) {
          handleError(
            'The "record" schema with a schema for the key that contains a "pipe" cannot be converted to JSON Schema.',
            config
          );
        }
        if (valibotSchema.key.type !== "string") {
          handleError(
            `The "record" schema with the "${valibotSchema.key.type}" schema for the key cannot be converted to JSON Schema.`,
            config
          );
        }
        apiSchema.type = "object";
        apiSchema.additionalProperties = convertSchema(
          {},
          valibotSchema.value as SchemaOrPipe,
          config,
          context
        );
        break;
      }

      // Special schemas

      case "any":
      case "unknown": {
        break;
      }

      case "nullable":
      case "nullish": {
        apiSchema = convertSchema(
          {},
          valibotSchema.wrapped as SchemaOrPipe,
          config,
          context
        );

        // Add null to OpenAPI Schema
        if (isOpenAPIv3(apiSchema, config)) {
          apiSchema.nullable = true;

          if (valibotSchema.wrapped.type === "picklist") {
            apiSchema.enum = apiSchema.enum || [];
            apiSchema.enum.push(null);
          }
        } else if (isOpenAPIv3_1(apiSchema, config)) {
          if (
            valibotSchema.wrapped.type === "union" ||
            valibotSchema.wrapped.type === "variant"
          ) {
            apiSchema.anyOf = apiSchema.anyOf || [];
            apiSchema.anyOf.push({ type: "null" });
          } else {
            if (Array.isArray(apiSchema.type)) {
              if (!apiSchema.type.includes("null")) {
                apiSchema.type.push("null");
              }
            } else {
              if (apiSchema.type != null)
                apiSchema.type = [apiSchema.type, "null"];
            }
          }
        }

        // Add default value to JSON Schema, if available
        if (valibotSchema.default !== undefined && !("$ref" in apiSchema)) {
          apiSchema.default = v.getDefault(valibotSchema);
        }

        break;
      }

      case "optional":
      case "undefinedable": {
        // Convert wrapped schema to JSON Schema
        apiSchema = convertSchema(
          apiSchema,
          valibotSchema.wrapped as SchemaOrPipe,
          config,
          context
        );

        // Add default value to JSON Schema, if available
        if (valibotSchema.default !== undefined) {
          // @ts-expect-error
          apiSchema.default = v.getDefault(valibotSchema);
        }

        break;
      }

      case "literal": {
        if (
          typeof valibotSchema.literal !== "boolean" &&
          typeof valibotSchema.literal !== "number" &&
          typeof valibotSchema.literal !== "string"
        ) {
          handleError(
            'The value of the "literal" schema is not JSON compatible.',
            config
          );
        }

        apiSchema.type = typeof valibotSchema.literal as
          | "boolean"
          | "number"
          | "string";

        if (isOpenAPIv3_1(apiSchema, config)) {
          apiSchema.const = valibotSchema.literal;
        } else {
          apiSchema.enum = [valibotSchema.literal];
        }
        break;
      }

      case "enum":
      case "picklist": {
        if (
          valibotSchema.options.some(
            (option) => typeof option !== "number" && typeof option !== "string"
          )
        ) {
          handleError(
            'An option of the "picklist" schema is not JSON compatible.',
            config
          );
        }

        if (valibotSchema.options.every((option) => typeof option === "number"))
          apiSchema.type = "number";
        else if (
          valibotSchema.options.every((option) => typeof option === "string")
        )
          apiSchema.type = "string";
        else apiSchema.type = ["string", "number"];

        // @ts-expect-error
        apiSchema.enum = valibotSchema.options;
        break;
      }

      case "union":
      case "variant": {
        apiSchema.anyOf = valibotSchema.options.map((option) =>
          convertSchema({}, option as SchemaOrPipe, config, context)
        );
        break;
      }

      case "intersect": {
        apiSchema.allOf = valibotSchema.options.map((option) =>
          convertSchema({}, option as SchemaOrPipe, config, context)
        );
        break;
      }

      case "lazy": {
        // Get wrapped Valibot schema
        let wrappedValibotSchema = context.getterMap.get(valibotSchema.getter);

        // Add wrapped Valibot schema to getter map, if necessary
        if (!wrappedValibotSchema) {
          wrappedValibotSchema = valibotSchema.getter(undefined);
          context.getterMap.set(valibotSchema.getter, wrappedValibotSchema);
        }

        // Get reference ID of wrapped Valibot schema
        let referenceId = context.referenceMap.get(wrappedValibotSchema);

        // Add wrapped Valibot schema to reference map and definitions, if necessary
        if (!referenceId) {
          referenceId = `${refCount++}`;
          context.referenceMap.set(wrappedValibotSchema, referenceId);
          context.definitions[referenceId] = convertSchema(
            {},
            wrappedValibotSchema as SchemaOrPipe,
            config,
            context
          );
        }

        // Add reference to JSON Schema object
        apiSchema = { $ref: `#/components/schemas/${referenceId}` };

        break;
      }

      // Other schemas

      default: {
        handleError(
          // @ts-expect-error
          `The "${valibotSchema.type}" schema cannot be converted to JSON Schema.`,
          config
        );
      }
    }
  }

  // Return converted OpenAPI Schema
  return apiSchema;
}

function isOpenAPIv3_1<T extends OpenAPIVersions>(
  apiSchema: OpenAPISchema<T>,
  config: ConversionConfig<T> = {}
  // @ts-expect-error
): apiSchema is OpenAPIV3_1.SchemaObject {
  return config?.version === "3.1.0";
}

function isOpenAPIv3<T extends OpenAPIVersions>(
  apiSchema: OpenAPISchema<T>,
  config: ConversionConfig<T> = {}
): apiSchema is OpenAPIV3.SchemaObject {
  return config?.version !== "3.1.0";
}
