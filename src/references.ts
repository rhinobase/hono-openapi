import type { OpenAPIV3_1 } from "openapi-types";

const COMPONENTS_PREFIX = "#/components/";
export const SCHEMA_REF = `${COMPONENTS_PREFIX}schemas/`;

export const decodeName = (name: string) =>
  name.replaceAll("~1", "/").replaceAll("~0", "~");

export const encodeName = (name: string) =>
  name.replaceAll("~", "~0").replaceAll("/", "~1");

/** `ref` pointing at the name `rename` gives the schema component it refers to. */
const renameRef = (
  ref: string,
  rename: (name: string) => string | undefined,
) => {
  if (!ref.startsWith(SCHEMA_REF)) {
    return ref;
  }

  const renamed = rename(decodeName(ref.slice(SCHEMA_REF.length)));
  return renamed === undefined ? ref : `${SCHEMA_REF}${encodeName(renamed)}`;
};

/**
 * A discriminator mapping target pointing at the renamed component. OpenAPI
 * allows a reference or a bare component name there; any other reference,
 * such as an external URL, is left as it is.
 */
const renameMappingTarget = (
  target: string,
  rename: (name: string) => string | undefined,
) => {
  if (target.startsWith(SCHEMA_REF)) {
    return renameRef(target, rename);
  }
  if (target.includes("/") || target.includes("#")) {
    return target;
  }

  return rename(target) ?? target;
};

const isDiscriminator = (
  value: unknown,
): value is OpenAPIV3_1.DiscriminatorObject =>
  value != null &&
  typeof value === "object" &&
  typeof (value as { propertyName?: unknown }).propertyName === "string";

// These fields hold payload data, whose `$ref` keys aren't document references.
const LITERAL_FIELDS = new Set([
  "example",
  "default",
  "enum",
  "const",
  "value",
]);

// Keys inside these maps are names, even when they're e.g. `example` or `default`.
const REFERENCE_MAPS = new Set([
  "paths",
  "webhooks",
  "examples",
  "schemas",
  "parameters",
  "responses",
  "requestBodies",
  "headers",
  "content",
  "encoding",
  "links",
  "callbacks",
  "pathItems",
  "properties",
  "patternProperties",
  "$defs",
  "definitions",
  "dependentSchemas",
  "dependencies",
]);

/** Visits document references, skipping payload data and extension values. */
const mapReferences = <T>(
  value: T,
  reference: (target: string, mapping: boolean) => string,
  isMap = false,
): T => {
  if (Array.isArray(value)) {
    return value.map((item) => mapReferences(item, reference)) as T;
  }
  if (value == null || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (isMap) {
        return [key, mapReferences(item, reference)];
      }
      // Schema examples are an array of payloads; OpenAPI examples are a map
      // of Example Objects or references, whose `value` fields are payloads.
      if (
        LITERAL_FIELDS.has(key) ||
        key.startsWith("x-") ||
        (key === "examples" && Array.isArray(item))
      ) {
        return [key, item];
      }
      if (key === "$ref" && typeof item === "string") {
        return [key, reference(item, false)];
      }
      if (key === "discriminator" && isDiscriminator(item) && item.mapping) {
        return [
          key,
          {
            ...item,
            mapping: Object.fromEntries(
              Object.entries(item.mapping).map(([name, target]) => [
                name,
                reference(target, true),
              ]),
            ),
          },
        ];
      }
      return [key, mapReferences(item, reference, REFERENCE_MAPS.has(key))];
    }),
  ) as T;
};

/**
 * How widening a subschema changes what the schema around it accepts: it
 * widens it (`1`), narrows it (`-1`), or can do either (`0`).
 */
export type Polarity = -1 | 0 | 1;

// Widening a subschema under these widens the schema around it.
const POSITIVE_KEYWORDS = new Set([
  "additionalItems",
  "additionalProperties",
  "allOf",
  "anyOf",
  "dependencies",
  "dependentSchemas",
  "else",
  "items",
  "patternProperties",
  "prefixItems",
  "properties",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
]);

// These hold subschemas by name, so a name is never a keyword.
const SUBSCHEMA_MAPS = new Set([
  "$defs",
  "definitions",
  "dependencies",
  "dependentSchemas",
  "patternProperties",
  "properties",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value);

/**
 * The polarity of the subschemas under `key` in a schema with `polarity`.
 *
 * - `not` reverses it.
 * - `if` picks between `then` and `else`, and `oneOf` accepts only one match,
 *   so widening either can make a value fail as well as pass.
 * - `contains` widens, unless a `maxContains` caps how many items match it.
 * - Local definitions are neutral: their polarity is that of the places
 *   referring to them. So is any other keyword, which holds no subschema.
 */
const keywordPolarity = (
  key: string,
  schema: Record<string, unknown>,
  polarity: Polarity,
): Polarity => {
  if (key === "not") {
    return polarity === 0 ? 0 : (-polarity as Polarity);
  }
  if (key === "contains") {
    return Object.hasOwn(schema, "maxContains") ? 0 : polarity;
  }
  return POSITIVE_KEYWORDS.has(key) ? polarity : 0;
};

/**
 * `schema` with each subschema replaced by what `visit` returns for it, given
 * its polarity and its path below `schema`. Payload data and extension values
 * are left as they are.
 */
const mapSubschemas = (
  schema: Record<string, unknown>,
  polarity: Polarity,
  visit: (
    subschema: unknown,
    polarity: Polarity,
    path: PropertyKey[],
  ) => unknown,
) =>
  Object.fromEntries(
    Object.entries(schema).map(([key, value]) => {
      if (
        LITERAL_FIELDS.has(key) ||
        key.startsWith("x-") ||
        key === "examples"
      ) {
        return [key, value];
      }
      const inner = keywordPolarity(key, schema, polarity);
      const visitAll = (item: unknown, path: PropertyKey[]) =>
        Array.isArray(item)
          ? item.map((entry, index) => visit(entry, inner, [...path, index]))
          : visit(item, inner, path);
      return [
        key,
        SUBSCHEMA_MAPS.has(key) && isRecord(value)
          ? Object.fromEntries(
              Object.entries(value).map(([name, item]) => [
                name,
                visitAll(item, [key, name]),
              ]),
            )
          : visitAll(value, [key]),
      ];
    }),
  );

const at = (value: unknown, path: PropertyKey[]) =>
  path.reduce<unknown>(
    (item, key) =>
      item != null && typeof item === "object"
        ? (item as Record<PropertyKey, unknown>)[key]
        : undefined,
    value,
  );

/**
 * `output` without the `additionalProperties: false` it adds to `input` where
 * leaving it out widens what `output` accepts in a place with `polarity`.
 */
export const withoutAddedClosures = (
  output: unknown,
  input: unknown,
  polarity: Polarity,
): unknown => {
  if (!isRecord(output) || polarity === 0) {
    return output;
  }

  const { additionalProperties, ...rest } = output;
  const opened =
    polarity === 1 &&
    additionalProperties === false &&
    at(input, ["additionalProperties"]) !== false;
  return mapSubschemas(opened ? rest : output, polarity, (item, inner, path) =>
    withoutAddedClosures(item, at(input, path), inner),
  );
};

/**
 * The schema components `schema` refers to, each with the polarity of the
 * reference.
 */
const schemaRefs = (
  schema: unknown,
  polarity: Polarity,
): [string, Polarity][] => {
  if (!isRecord(schema)) {
    return [];
  }

  const refs: [string, Polarity][] =
    typeof schema.$ref === "string" && schema.$ref.startsWith(SCHEMA_REF)
      ? [[decodeName(schema.$ref.slice(SCHEMA_REF.length)), polarity]]
      : [];
  mapSubschemas(schema, polarity, (item, inner) => {
    refs.push(...schemaRefs(item, inner));
    return item;
  });
  return refs;
};

/**
 * The schema components the schemas in `value`, an OpenAPI document or part of
 * one, refer to, each with the polarity of the reference.
 */
const documentSchemaRefs = (
  value: unknown,
  isMap = false,
): [string, Polarity][] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => documentSchemaRefs(item));
  }
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, item]) => {
    if (isMap) {
      return documentSchemaRefs(item);
    }
    if (LITERAL_FIELDS.has(key) || key.startsWith("x-") || key === "examples") {
      return [];
    }
    if (key === "schema") {
      return schemaRefs(item, 1);
    }
    return documentSchemaRefs(item, REFERENCE_MAPS.has(key));
  });
};

/**
 * The polarities each of `schemas` is used with in `document`, directly or
 * through other components.
 */
export const schemaPolarities = (
  schemas: Record<string, unknown>,
  document: unknown,
) => {
  const polarities = new Map<string, Set<Polarity>>();
  const pending = documentSchemaRefs(document);
  for (let ref = pending.pop(); ref !== undefined; ref = pending.pop()) {
    const [name, polarity] = ref;
    const used = polarities.get(name) ?? new Set();
    if (Object.hasOwn(schemas, name) && !used.has(polarity)) {
      polarities.set(name, used.add(polarity));
      pending.push(...schemaRefs(schemas[name], polarity));
    }
  }
  return polarities;
};

/** Rename schema references, including discriminator mapping targets. */
export const renameSchemaRefs = <T>(
  value: T,
  rename: (name: string) => string | undefined,
  isMap = false,
): T =>
  mapReferences(
    value,
    (target, mapping) =>
      mapping ? renameMappingTarget(target, rename) : renameRef(target, rename),
    isMap,
  );

/** Component dependencies as `type/name`, including discriminator mappings. */
export const componentRefs = (value: unknown): string[] => {
  const refs: string[] = [];
  mapReferences(value, (target, mapping) => {
    if (target.startsWith(COMPONENTS_PREFIX)) {
      refs.push(target.slice(COMPONENTS_PREFIX.length));
    } else if (mapping && !target.includes("/") && !target.includes("#")) {
      refs.push(`schemas/${encodeName(target)}`);
    }
    return target;
  });
  return refs;
};
