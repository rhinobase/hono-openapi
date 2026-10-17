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
