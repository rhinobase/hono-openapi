import type { RouterRoute } from "hono/types";

/**
 * Unique symbol for MCP marker middlewares, which makes it easier to identify them.
 * Not meant to be used directly, unless you're creating a custom middleware.
 */
export const mcpSymbol = Symbol("mcp");

/**
 * Convert a Hono route path to a valid MCP tool/resource name
 * Example: "/api/users/:id" -> "api_users_by_id"
 */
export function pathToName(path: string, method?: string): string {
  let name = path
    // Remove leading slash
    .replace(/^\//, "")
    // Replace path parameters with "by_paramName"
    .replace(/:([^/]+)/g, "by_$1")
    // Replace slashes with underscores
    .replace(/\//g, "_")
    // Remove any remaining special characters
    .replace(/[^a-zA-Z0-9_]/g, "_")
    // Remove consecutive underscores
    .replace(/_+/g, "_")
    // Remove trailing underscore
    .replace(/_$/, "");

  // Handle root path or empty name before prepending method
  if (!name || name === "_") {
    name = "index";
  }

  // Prepend method if provided
  if (method) {
    name = `${method.toLowerCase()}_${name}`;
  }

  return name;
}

/**
 * Generate a default tool name from a route
 */
export function generateToolName(route: RouterRoute): string {
  return pathToName(route.path, route.method);
}

/**
 * Convert Hono path parameters to MCP URI template format
 * Example: "/users/:id/posts/:postId" -> "users/{id}/posts/{postId}"
 */
export function pathToUriTemplate(path: string, scheme = "hono"): string {
  const converted = path
    // Convert :param to {param}
    .replace(/:([^/]+)/g, "{$1}")
    // Remove optional marker if present
    .replace(/\?/g, "");

  return `${scheme}://${converted.replace(/^\//, "")}`;
}

/**
 * Check if a path matches any of the exclude patterns
 */
export function isExcluded(
  path: string,
  exclude?: string | RegExp | Array<string | RegExp>,
): boolean {
  if (!exclude) return false;

  const patterns = Array.isArray(exclude) ? exclude : [exclude];

  return patterns.some((pattern) => {
    if (typeof pattern === "string") {
      return path === pattern;
    }
    return pattern.test(path);
  });
}

/**
 * Extract URI template parameters from a URI string
 * Example: "users/{userId}/posts/{postId}" -> ["userId", "postId"]
 */
export function extractUriParameters(uri: string): string[] {
  const matches = uri.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map((match) => match.slice(1, -1));
}

/**
 * Check if a URI is a template (contains parameters)
 */
export function isUriTemplate(uri: string): boolean {
  return /\{[^}]+\}/.test(uri);
}
