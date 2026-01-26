import type { Env, Hono } from "hono";
import type { BlankEnv, BlankSchema, Schema } from "hono/types";
import { findTargetHandler } from "hono/utils/handler";
import type { JSONSchema7 } from "json-schema";
import { uniqueSymbol } from "../utils.js";
import type {
  GenerateMcpOptions,
  McpConfig,
  McpMarker,
  McpPrompt,
  McpPromptArgument,
  McpResource,
  McpTool,
} from "./types.js";
import {
  generateToolName,
  isExcluded,
  mcpSymbol,
  pathToUriTemplate,
} from "./utils.js";

const DEFAULT_OPTIONS: Partial<GenerateMcpOptions> = {
  exclude: [],
  excludeMethods: ["OPTIONS", "HEAD"],
  includeUnmarkedRoutes: false,
};

/**
 * Generate MCP configuration from a Hono application.
 *
 * This function iterates through all routes in the Hono app and extracts
 * MCP metadata from routes that have been marked with `mcpTool`, `mcpPrompt`,
 * or `mcpResource` middlewares.
 *
 * Input schemas are automatically extracted from `validator()` middlewares.
 *
 * @param hono - The Hono application instance
 * @param options - Configuration options for MCP generation
 * @returns MCP configuration object with tools, prompts, and resources
 *
 * @example
 * ```typescript
 * const app = new Hono()
 *   .post(
 *     "/weather",
 *     mcpTool({ name: "get_weather", description: "Get weather" }),
 *     validator("json", z.object({ location: z.string() })),
 *     async (c) => c.json({ temperature: 72 })
 *   );
 *
 * const mcpConfig = await generateMcp(app, {
 *   name: "weather-server",
 *   version: "1.0.0"
 * });
 * ```
 */
export async function generateMcp<
  E extends Env = BlankEnv,
  S extends Schema = BlankSchema,
  P extends string = string,
>(hono: Hono<E, S, P>, options: GenerateMcpOptions): Promise<McpConfig> {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const tools: McpTool[] = [];
  const prompts: McpPrompt[] = [];
  const resources: McpResource[] = [];

  for (const route of hono.routes) {
    // Skip excluded paths
    if (isExcluded(route.path, opts.exclude)) {
      continue;
    }

    // Skip excluded methods
    if (opts.excludeMethods?.includes(route.method.toUpperCase())) {
      continue;
    }

    // Get the handler and check for MCP markers
    const handler = findTargetHandler(route.handler);
    const mcpMarker = handler[mcpSymbol] as McpMarker | undefined;
    const validatorMarker = handler[uniqueSymbol] as
      | {
          target: string;
          toJSONSchema: () => JSONSchema7 | Promise<JSONSchema7>;
        }
      | undefined;

    // If no MCP marker, optionally include as unmarked tool
    if (!mcpMarker) {
      if (opts.includeUnmarkedRoutes && validatorMarker) {
        const inputSchema = await resolveInputSchema(validatorMarker);
        tools.push({
          name: generateToolName(route),
          description: `${route.method} ${route.path}`,
          inputSchema: inputSchema || { type: "object", properties: {} },
        });
      }
      continue;
    }

    // Process based on marker type
    switch (mcpMarker.type) {
      case "tool": {
        const inputSchema = await resolveInputSchema(validatorMarker);
        const outputSchema = await resolveOutputSchema(
          mcpMarker.options.outputSchema,
        );

        tools.push({
          name: mcpMarker.options.name,
          title: mcpMarker.options.title,
          description: mcpMarker.options.description,
          inputSchema: inputSchema || { type: "object", properties: {} },
          outputSchema,
          annotations: mcpMarker.options.annotations,
        });
        break;
      }

      case "prompt": {
        const args = resolvePromptArguments(
          mcpMarker.options.arguments,
          validatorMarker,
        );

        prompts.push({
          name: mcpMarker.options.name,
          title: mcpMarker.options.title,
          description: mcpMarker.options.description,
          arguments: args,
        });
        break;
      }

      case "resource": {
        resources.push({
          name: mcpMarker.options.name,
          uri: mcpMarker.options.uri || pathToUriTemplate(route.path),
          title: mcpMarker.options.title,
          description: mcpMarker.options.description,
          mimeType: mcpMarker.options.mimeType,
          annotations: mcpMarker.options.annotations,
        });
        break;
      }
    }
  }

  return {
    serverInfo: {
      name: opts.name,
      version: opts.version,
    },
    tools,
    prompts,
    resources,
  };
}

/**
 * Resolve input schema from validator marker
 */
async function resolveInputSchema(validatorMarker?: {
  toJSONSchema: () => JSONSchema7 | Promise<JSONSchema7>;
}): Promise<JSONSchema7 | undefined> {
  if (!validatorMarker?.toJSONSchema) {
    return undefined;
  }

  try {
    const schema = await validatorMarker.toJSONSchema();
    return schema;
  } catch {
    return undefined;
  }
}

/**
 * Resolve output schema from options
 */
async function resolveOutputSchema(
  outputSchema?: unknown,
): Promise<JSONSchema7 | undefined> {
  if (!outputSchema) {
    return undefined;
  }

  // If it's already a JSON Schema
  if (isJsonSchema(outputSchema)) {
    return outputSchema;
  }

  // If it's a Standard Schema with toJSONSchema method
  if (hasToJSONSchema(outputSchema)) {
    try {
      return await outputSchema.toJSONSchema();
    } catch {
      return undefined;
    }
  }

  // If it has ~standard property (Standard Schema)
  if (isStandardSchema(outputSchema)) {
    // Import resolver dynamically to convert
    const { resolver } = await import("../middlewares.js");
    const resolved = resolver(outputSchema);
    return await resolved.toJSONSchema();
  }

  return undefined;
}

/**
 * Resolve prompt arguments from options or validator
 */
function resolvePromptArguments(
  args?: McpPromptArgument[] | unknown,
  validatorMarker?: { toJSONSchema: () => JSONSchema7 | Promise<JSONSchema7> },
): McpPromptArgument[] | undefined {
  // If arguments are explicitly provided as array, use them
  if (Array.isArray(args)) {
    return args;
  }

  // If arguments is a Standard Schema, we could extract from it
  // For now, fall back to validator schema properties
  if (validatorMarker?.toJSONSchema) {
    // We can't await here, so we'll handle this in the async context
    // For now, return undefined and let the caller handle async resolution
    return undefined;
  }

  return undefined;
}

/**
 * Type guard for JSON Schema
 */
function isJsonSchema(value: unknown): value is JSONSchema7 {
  return (
    typeof value === "object" &&
    value !== null &&
    ("type" in value || "properties" in value || "$ref" in value)
  );
}

/**
 * Type guard for objects with toJSONSchema method
 */
function hasToJSONSchema(
  value: unknown,
): value is { toJSONSchema: () => JSONSchema7 | Promise<JSONSchema7> } {
  return (
    typeof value === "object" &&
    value !== null &&
    "toJSONSchema" in value &&
    typeof (value as { toJSONSchema: unknown }).toJSONSchema === "function"
  );
}

/**
 * Type guard for Standard Schema
 */
function isStandardSchema(
  value: unknown,
): value is { "~standard": { vendor: string; validate: unknown } } {
  return (
    typeof value === "object" &&
    value !== null &&
    "~standard" in value &&
    typeof (value as { "~standard": unknown })["~standard"] === "object"
  );
}
