import type { MiddlewareHandler } from "hono";
import type {
  McpPromptOptions,
  McpResourceOptions,
  McpToolOptions,
} from "./types.js";
import { mcpSymbol } from "./utils.js";

/**
 * Mark a route as an MCP tool.
 *
 * The input schema will be automatically extracted from any `validator()` middleware
 * applied to the same route.
 *
 * @param options - Tool configuration options
 * @returns Middleware handler with MCP tool metadata attached
 *
 * @example
 * ```typescript
 * app.post(
 *   "/weather",
 *   mcpTool({
 *     name: "get_weather",
 *     title: "Get Weather",
 *     description: "Get current weather for a location",
 *   }),
 *   validator("json", z.object({ location: z.string() })),
 *   async (c) => c.json({ temperature: 72 })
 * );
 * ```
 */
export function mcpTool(options: McpToolOptions): MiddlewareHandler {
  const middleware: MiddlewareHandler = async (_c, next) => {
    await next();
  };

  return Object.assign(middleware, {
    [mcpSymbol]: {
      type: "tool" as const,
      options,
    },
  });
}

/**
 * Mark a route as an MCP prompt.
 *
 * Prompts are reusable templates that help structure interactions with language models.
 *
 * @param options - Prompt configuration options
 * @returns Middleware handler with MCP prompt metadata attached
 *
 * @example
 * ```typescript
 * app.post(
 *   "/review",
 *   mcpPrompt({
 *     name: "code_review",
 *     title: "Code Review",
 *     description: "Review code for best practices",
 *     arguments: [
 *       { name: "code", description: "Code to review", required: true }
 *     ]
 *   }),
 *   validator("json", z.object({ code: z.string() })),
 *   async (c) => c.json({
 *     messages: [{ role: "user", content: { type: "text", text: "Review this code..." }}]
 *   })
 * );
 * ```
 */
export function mcpPrompt(options: McpPromptOptions): MiddlewareHandler {
  const middleware: MiddlewareHandler = async (_c, next) => {
    await next();
  };

  return Object.assign(middleware, {
    [mcpSymbol]: {
      type: "prompt" as const,
      options,
    },
  });
}

/**
 * Mark a route as an MCP resource.
 *
 * Resources provide contextual data that can be read by clients.
 * They can have static URIs or URI templates with parameters.
 *
 * @param options - Resource configuration options
 * @returns Middleware handler with MCP resource metadata attached
 *
 * @example
 * ```typescript
 * // Static resource
 * app.get(
 *   "/config",
 *   mcpResource({
 *     name: "app_config",
 *     uri: "config://app",
 *     title: "Application Config",
 *     mimeType: "application/json"
 *   }),
 *   async (c) => c.json({ theme: "dark" })
 * );
 *
 * // Dynamic resource with template
 * app.get(
 *   "/users/:id",
 *   mcpResource({
 *     name: "user_profile",
 *     uri: "users://{id}/profile",
 *     title: "User Profile",
 *     mimeType: "application/json"
 *   }),
 *   validator("param", z.object({ id: z.string() })),
 *   async (c) => c.json({ id: c.req.param("id"), name: "User" })
 * );
 * ```
 */
export function mcpResource(options: McpResourceOptions): MiddlewareHandler {
  const middleware: MiddlewareHandler = async (_c, next) => {
    await next();
  };

  return Object.assign(middleware, {
    [mcpSymbol]: {
      type: "resource" as const,
      options,
    },
  });
}
