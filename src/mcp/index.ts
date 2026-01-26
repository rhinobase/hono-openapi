// Middlewares

// OpenAPI to MCP converter
export { createMcpFromOpenApiSpec } from "./from-openapi.js";

// Generator
export { generateMcp } from "./generator.js";
export { mcpPrompt, mcpResource, mcpTool } from "./middlewares.js";
// Types
export type {
  // Options types
  GenerateMcpOptions,
  McpConfig,
  // Marker types
  McpMarker,
  McpPrimitiveType,
  McpPrompt,
  McpPromptArgument,
  McpPromptContent,
  McpPromptMarker,
  McpPromptMessage,
  McpPromptOptions,
  McpResource,
  McpResourceAnnotations,
  McpResourceMarker,
  McpResourceOptions,
  McpServerInfo,
  // Generated types
  McpTool,
  McpToolAnnotations,
  McpToolMarker,
  // Primitive options
  McpToolOptions,
  OpenApiToMcpOptions,
} from "./types.js";
// Utils (only export what's needed for custom extensions)
export { mcpSymbol, pathToName, pathToUriTemplate } from "./utils.js";
