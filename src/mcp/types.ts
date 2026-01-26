import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { JSONSchema7 } from "json-schema";

export type McpPrimitiveType = "tool" | "prompt" | "resource";

// ============================================================================
// Tool Types
// ============================================================================

export type McpToolOptions = {
  /**
   * Unique name for the tool (used as identifier in MCP)
   */
  name: string;

  /**
   * Human-readable title for the tool
   */
  title?: string;

  /**
   * Description of what the tool does
   */
  description?: string;

  /**
   * Output schema for the tool's response (optional)
   * Can be a Standard Schema or a JSON Schema
   */
  outputSchema?: StandardSchemaV1 | JSONSchema7;

  /**
   * Additional annotations for the tool
   */
  annotations?: McpToolAnnotations;
};

export type McpToolAnnotations = {
  title?: string;
  /**
   * If true, the tool does not modify any state
   */
  readOnlyHint?: boolean;

  /**
   * If true, the tool may perform destructive operations
   */
  destructiveHint?: boolean;

  /**
   * If true, the tool may have side effects beyond its direct output
   */
  idempotentHint?: boolean;

  /**
   * If true, the tool interacts with the external world
   */
  openWorldHint?: boolean;
};

// ============================================================================
// Prompt Types
// ============================================================================

export type McpPromptArgument = {
  /**
   * Name of the argument
   */
  name: string;

  /**
   * Description of the argument
   */
  description?: string;

  /**
   * Whether this argument is required
   */
  required?: boolean;
};

export type McpPromptOptions = {
  /**
   * Unique name for the prompt
   */
  name: string;

  /**
   * Human-readable title for the prompt
   */
  title?: string;

  /**
   * Description of what the prompt does
   */
  description?: string;

  /**
   * Arguments that the prompt accepts
   * Can be an array of argument definitions or a Standard Schema
   */
  arguments?: McpPromptArgument[] | StandardSchemaV1;
};

export type McpPromptMessage = {
  role: "user" | "assistant";
  content: McpPromptContent;
};

export type McpPromptContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | {
      type: "resource";
      resource: { uri: string; text?: string; blob?: string };
    };

// ============================================================================
// Resource Types
// ============================================================================

export type McpResourceOptions = {
  /**
   * Unique name for the resource
   */
  name: string;

  /**
   * URI or URI template for the resource
   * Static: "config://app"
   * Template: "users://{userId}/profile"
   */
  uri: string;

  /**
   * Human-readable title for the resource
   */
  title?: string;

  /**
   * Description of the resource
   */
  description?: string;

  /**
   * MIME type of the resource content
   */
  mimeType?: string;

  /**
   * Additional annotations for the resource
   */
  annotations?: McpResourceAnnotations;
};

export type McpResourceAnnotations = {
  /**
   * Intended audience for this resource
   */
  audience?: ("user" | "assistant")[];

  /**
   * Priority hint for ordering (0-1, higher = more important)
   */
  priority?: number;
};

// ============================================================================
// Handler Metadata Types
// ============================================================================

export type McpToolMarker = {
  type: "tool";
  options: McpToolOptions;
};

export type McpPromptMarker = {
  type: "prompt";
  options: McpPromptOptions;
};

export type McpResourceMarker = {
  type: "resource";
  options: McpResourceOptions;
};

export type McpMarker = McpToolMarker | McpPromptMarker | McpResourceMarker;

// ============================================================================
// Generator Types
// ============================================================================

export type McpServerInfo = {
  /**
   * Name of the MCP server
   */
  name: string;

  /**
   * Version of the MCP server
   */
  version: string;
};

export type GenerateMcpOptions = McpServerInfo & {
  /**
   * Paths to exclude from MCP generation
   */
  exclude?: string | RegExp | Array<string | RegExp>;

  /**
   * HTTP methods to exclude
   */
  excludeMethods?: string[];

  /**
   * Whether to include routes without MCP markers as tools
   * @default false
   */
  includeUnmarkedRoutes?: boolean;
};

export type McpTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema: JSONSchema7;
  outputSchema?: JSONSchema7;
  annotations?: McpToolAnnotations;
};

export type McpPrompt = {
  name: string;
  title?: string;
  description?: string;
  arguments?: McpPromptArgument[];
};

export type McpResource = {
  name: string;
  uri: string;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: McpResourceAnnotations;
};

export type McpConfig = {
  serverInfo: McpServerInfo;
  tools: McpTool[];
  prompts: McpPrompt[];
  resources: McpResource[];
};

// ============================================================================
// OpenAPI to MCP Types
// ============================================================================

export type OpenApiToMcpOptions = {
  /**
   * Filter operations by tags
   */
  includeTags?: string[];

  /**
   * Exclude operations by tags
   */
  excludeTags?: string[];

  /**
   * Filter operations by paths (regex patterns)
   */
  includePaths?: (string | RegExp)[];

  /**
   * Exclude operations by paths (regex patterns)
   */
  excludePaths?: (string | RegExp)[];

  /**
   * HTTP methods to include
   * @default ["GET", "POST", "PUT", "PATCH", "DELETE"]
   */
  includeMethods?: string[];

  /**
   * Custom tool name generator
   */
  toolNameGenerator?: (
    operationId: string,
    method: string,
    path: string,
  ) => string;

  /**
   * Whether to include response schemas as output schemas
   * @default false
   */
  includeOutputSchemas?: boolean;
};
