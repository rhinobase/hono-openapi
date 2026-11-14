import type * as Types from "./types.js";
import * as utils from "./utils.js";

export { generateSpecs, openAPIRouteHandler } from "./handler.js";
export {
  describeResponse,
  describeRoute,
  loadVendor,
  resolver,
  validator,
} from "./middlewares.js";
export type * from "./types.js";
export { ALLOWED_METHODS, type AllowedMethods, uniqueSymbol } from "./utils.js";

// The helpers below are steps inside `generateSpecs`. They're deprecated where
// they're exported, so the code using them internally isn't flagged too.

/**
 * @deprecated `generateSpecs` keeps its own path context for each generation,
 * so this doesn't affect a generated document. It will be removed in the next
 * major version.
 */
export const clearSpecsContext = utils.clearSpecsContext;

/**
 * @deprecated An internal step of `generateSpecs`, which only works on the
 * operations it builds. Use `generateSpecs` instead. It will be removed in the
 * next major version.
 */
export const documentedComponents = utils.documentedComponents;

/**
 * @deprecated An internal step of `generateSpecs`, which only works on the
 * operations it builds. Use `generateSpecs` instead. It will be removed in the
 * next major version.
 */
export const getSpecComponents = utils.getSpecComponents;

/**
 * @deprecated An internal step of `generateSpecs`. Use `generateSpecs`
 * instead. It will be removed in the next major version.
 */
export const registerSchemaPath = utils.registerSchemaPath;

/**
 * @deprecated An internal step of `generateSpecs`. Use `generateSpecs`
 * instead. It will be removed in the next major version.
 */
export const removeExcludedPaths = utils.removeExcludedPaths;

/**
 * @deprecated An internal step of `generateSpecs`, which only works on the
 * operations it builds. Use `generateSpecs` instead. It will be removed in the
 * next major version.
 */
export const setSpecComponents = utils.setSpecComponents;

/**
 * @deprecated A key set on an operation while `generateSpecs` builds it, and
 * removed before the document is returned. It will be removed in the next
 * major version.
 */
export const VALIDATION_MARKER = utils.VALIDATION_MARKER;

/**
 * @deprecated The options of the internal `registerSchemaPath`. It will be
 * removed in the next major version.
 */
export type RegisterSchemaPathOptions = Types.RegisterSchemaPathOptions;

/**
 * @deprecated The context of the internal generation steps. It will be removed
 * in the next major version.
 */
export type SpecContext = Types.SpecContext;
