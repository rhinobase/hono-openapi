import type {
  OpenAPIDocument,
  OpenAPIOperation,
  OpenAPIPathItem,
} from "./types";
import { ALLOWED_METHODS, type AllowedMethods } from "./utils";

/** Select the minimum version from the operations that survived generation. */
export const resolveOpenAPIVersion = (
  document: OpenAPIDocument,
  explicit?: string,
): string => {
  const seen = new Set<OpenAPIPathItem>();
  const methods = ALLOWED_METHODS.map(
    (method) => method.toLowerCase() as Lowercase<AllowedMethods>,
  );
  const callbacksHaveQuery = (
    callbacks: OpenAPIOperation["callbacks"],
  ): boolean =>
    Object.values(callbacks ?? {}).some((callback) =>
      Object.entries(callback).some(
        ([key, item]) =>
          !key.startsWith("x-") && key !== "$ref" && hasQuery(item),
      ),
    );
  const hasQuery = (item: OpenAPIPathItem | undefined): boolean => {
    if (!item || typeof item !== "object" || seen.has(item)) return false;
    seen.add(item);
    if (item.query) return true;

    return methods.some((method) =>
      callbacksHaveQuery(item[method]?.callbacks),
    );
  };

  // Only visit Path Item positions. A schema, example, or extension can also
  // contain a property named `query`, but it isn't an HTTP operation.
  const query =
    Object.entries(document.paths).some(
      ([path, item]) => path.startsWith("/") && hasQuery(item),
    ) ||
    Object.values(document.webhooks ?? {}).some(hasQuery) ||
    Object.values(document.components?.pathItems ?? {}).some(hasQuery) ||
    callbacksHaveQuery(document.components?.callbacks);

  if (query && explicit !== undefined) {
    const version = /^(\d+)\.(\d+)\.\d+$/.exec(explicit);
    if (
      !version ||
      Number(version[1]) < 3 ||
      (Number(version[1]) === 3 && Number(version[2]) < 2)
    ) {
      throw new Error(
        `QUERY operations require OpenAPI 3.2 or later; documentation.openapi is "${explicit}".`,
      );
    }
  }

  return explicit ?? (query ? "3.2.0" : "3.1.0");
};
