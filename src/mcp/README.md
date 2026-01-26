# MCP (Model Context Protocol) Integration

This module provides tools to generate [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) configurations from your Hono application. MCP is an open protocol that enables seamless integration between AI assistants and external tools, prompts, and resources.

## Installation

```bash
npm install hono-openapi
# or
pnpm add hono-openapi
```

## Import

```typescript
import {
  // Middlewares
  mcpTool,
  mcpPrompt,
  mcpResource,
  // Generator
  generateMcp,
  // OpenAPI converter
  createMcpFromOpenApiSpec,
  // Utilities
  pathToName,
  pathToUriTemplate,
  mcpSymbol,
} from "hono-openapi/mcp";
```

## Quick Start

Here's a complete example of creating an MCP-enabled Hono application:

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { validator } from "hono-openapi";
import { generateMcp, mcpTool } from "hono-openapi/mcp";

const app = new Hono()
  .post(
    "/weather",
    mcpTool({
      name: "get_weather",
      title: "Get Weather",
      description: "Get current weather for a location",
    }),
    validator("json", z.object({ location: z.string() })),
    async (c) => {
      const { location } = c.req.valid("json");
      return c.json({ location, temperature: 72, condition: "sunny" });
    }
  );

// Generate MCP configuration
const mcpConfig = await generateMcp(app, {
  name: "weather-server",
  version: "1.0.0",
});

console.log(mcpConfig);
// {
//   serverInfo: { name: "weather-server", version: "1.0.0" },
//   tools: [{
//     name: "get_weather",
//     title: "Get Weather",
//     description: "Get current weather for a location",
//     inputSchema: { type: "object", properties: { location: { type: "string" } }, required: ["location"] }
//   }],
//   prompts: [],
//   resources: []
// }
```

## Middlewares

### `mcpTool(options)`

Mark a route as an MCP tool. Tools are executable functions that AI assistants can invoke.

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | **Required.** Unique identifier for the tool |
| `title` | `string` | Human-readable title |
| `description` | `string` | Description of what the tool does |
| `outputSchema` | `StandardSchema \| JSONSchema7` | Schema for the tool's response |
| `annotations` | `McpToolAnnotations` | Additional metadata hints |

**Annotations:**

| Annotation | Type | Description |
|------------|------|-------------|
| `readOnlyHint` | `boolean` | If true, the tool does not modify any state |
| `destructiveHint` | `boolean` | If true, the tool may perform destructive operations |
| `idempotentHint` | `boolean` | If true, the tool may have side effects beyond its direct output |
| `openWorldHint` | `boolean` | If true, the tool interacts with the external world |

**Example:**

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { validator } from "hono-openapi";
import { mcpTool } from "hono-openapi/mcp";

const app = new Hono()
  .post(
    "/search",
    mcpTool({
      name: "search_database",
      title: "Search Database",
      description: "Search the database for matching records",
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    }),
    validator("json", z.object({
      query: z.string().describe("Search query"),
      limit: z.number().optional().default(10),
    })),
    async (c) => {
      const { query, limit } = c.req.valid("json");
      // ... search logic
      return c.json({ results: [], total: 0 });
    }
  );
```

> **Note:** The input schema is automatically extracted from any `validator()` middleware applied to the same route.

---

### `mcpPrompt(options)`

Mark a route as an MCP prompt. Prompts are reusable templates that help structure interactions with language models.

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | **Required.** Unique identifier for the prompt |
| `title` | `string` | Human-readable title |
| `description` | `string` | Description of what the prompt does |
| `arguments` | `McpPromptArgument[] \| StandardSchema` | Arguments the prompt accepts |

**Argument Structure:**

```typescript
type McpPromptArgument = {
  name: string;
  description?: string;
  required?: boolean;
};
```

**Example:**

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { validator } from "hono-openapi";
import { mcpPrompt } from "hono-openapi/mcp";

const app = new Hono()
  .post(
    "/review",
    mcpPrompt({
      name: "code_review",
      title: "Code Review",
      description: "Review code for best practices and potential issues",
      arguments: [
        { name: "code", description: "The code to review", required: true },
        { name: "language", description: "Programming language", required: false },
      ],
    }),
    validator("json", z.object({
      code: z.string(),
      language: z.string().optional(),
    })),
    async (c) => {
      const { code, language } = c.req.valid("json");
      return c.json({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Review this ${language || "code"}:\n\n${code}`,
            },
          },
        ],
      });
    }
  );
```

---

### `mcpResource(options)`

Mark a route as an MCP resource. Resources provide contextual data that can be read by clients.

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | **Required.** Unique identifier for the resource |
| `uri` | `string` | **Required.** URI or URI template (e.g., `"config://app"` or `"users://{id}/profile"`) |
| `title` | `string` | Human-readable title |
| `description` | `string` | Description of the resource |
| `mimeType` | `string` | MIME type of the resource content |
| `annotations` | `McpResourceAnnotations` | Additional metadata |

**Annotations:**

| Annotation | Type | Description |
|------------|------|-------------|
| `audience` | `("user" \| "assistant")[]` | Intended audience for this resource |
| `priority` | `number` | Priority hint for ordering (0-1, higher = more important) |

**Example - Static Resource:**

```typescript
import { Hono } from "hono";
import { mcpResource } from "hono-openapi/mcp";

const app = new Hono()
  .get(
    "/config",
    mcpResource({
      name: "app_config",
      uri: "config://app",
      title: "Application Configuration",
      description: "Current application configuration settings",
      mimeType: "application/json",
      annotations: {
        audience: ["assistant"],
        priority: 0.8,
      },
    }),
    async (c) => c.json({ theme: "dark", language: "en" })
  );
```

**Example - Dynamic Resource with Template:**

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { validator } from "hono-openapi";
import { mcpResource } from "hono-openapi/mcp";

const app = new Hono()
  .get(
    "/users/:id",
    mcpResource({
      name: "user_profile",
      uri: "users://{id}/profile",
      title: "User Profile",
      description: "Profile information for a specific user",
      mimeType: "application/json",
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      const { id } = c.req.valid("param");
      return c.json({ id, name: "John Doe", email: "john@example.com" });
    }
  );
```

## Generator

### `generateMcp(app, options)`

Extract MCP configuration from a Hono application. This function iterates through all routes and extracts metadata from routes marked with MCP middlewares.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `app` | `Hono` | The Hono application instance |
| `options` | `GenerateMcpOptions` | Configuration options |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | **Required** | Name of the MCP server |
| `version` | `string` | **Required** | Version of the MCP server |
| `exclude` | `string \| RegExp \| Array` | `[]` | Paths to exclude from generation |
| `excludeMethods` | `string[]` | `["OPTIONS", "HEAD"]` | HTTP methods to exclude |
| `includeUnmarkedRoutes` | `boolean` | `false` | Include routes without MCP markers as tools |

**Returns:** `Promise<McpConfig>`

```typescript
type McpConfig = {
  serverInfo: { name: string; version: string };
  tools: McpTool[];
  prompts: McpPrompt[];
  resources: McpResource[];
};
```

**Example:**

```typescript
import { Hono } from "hono";
import { generateMcp, mcpTool, mcpResource } from "hono-openapi/mcp";

const app = new Hono()
  .post("/public/search", mcpTool({ name: "search", description: "Search" }), handler)
  .post("/internal/admin", mcpTool({ name: "admin", description: "Admin" }), handler)
  .get("/config", mcpResource({ name: "config", uri: "config://app" }), handler);

const config = await generateMcp(app, {
  name: "my-server",
  version: "1.0.0",
  exclude: ["/internal/admin", /^\/debug/],
  excludeMethods: ["OPTIONS", "HEAD", "TRACE"],
});

// Result: tools array excludes "admin", only contains "search"
```

**Including Unmarked Routes:**

```typescript
const config = await generateMcp(app, {
  name: "my-server",
  version: "1.0.0",
  includeUnmarkedRoutes: true, // Routes with validator() but no mcpTool() will be included
});
```

## OpenAPI Converter

### `createMcpFromOpenApiSpec(spec, options)`

Convert an existing OpenAPI 3.1 specification to MCP tools. This is useful when you want to expose your entire API (or a subset) as MCP tools without adding individual middlewares.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `spec` | `OpenAPIV3_1.Document` | OpenAPI 3.1 specification document |
| `options` | `OpenApiToMcpOptions` | Conversion options |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeTags` | `string[]` | - | Only include operations with these tags |
| `excludeTags` | `string[]` | - | Exclude operations with these tags |
| `includePaths` | `(string \| RegExp)[]` | - | Only include matching paths |
| `excludePaths` | `(string \| RegExp)[]` | - | Exclude matching paths |
| `includeMethods` | `string[]` | `["GET", "POST", "PUT", "PATCH", "DELETE"]` | HTTP methods to include |
| `toolNameGenerator` | `Function` | - | Custom function to generate tool names |
| `includeOutputSchemas` | `boolean` | `false` | Include response schemas as output schemas |

**Returns:** `McpTool[]`

**Example - Basic Usage:**

```typescript
import { generateSpecs } from "hono-openapi";
import { createMcpFromOpenApiSpec } from "hono-openapi/mcp";

// Generate OpenAPI spec from your Hono app
const openApiSpec = await generateSpecs(app, {
  documentation: {
    info: { title: "My API", version: "1.0.0" },
  },
});

// Convert to MCP tools
const tools = createMcpFromOpenApiSpec(openApiSpec);
```

**Example - Filtering by Tags:**

```typescript
const tools = createMcpFromOpenApiSpec(openApiSpec, {
  includeTags: ["public", "users"],
  excludeTags: ["internal", "admin"],
});
```

**Example - Filtering by Paths:**

```typescript
const tools = createMcpFromOpenApiSpec(openApiSpec, {
  includePaths: ["/api/v1/", /^\/public\//],
  excludePaths: ["/api/v1/internal", /^\/admin/],
});
```

**Example - Custom Tool Name Generator:**

```typescript
const tools = createMcpFromOpenApiSpec(openApiSpec, {
  toolNameGenerator: (operationId, method, path) => {
    // Use operationId if available, otherwise generate from method and path
    if (operationId) return operationId;
    return `${method.toLowerCase()}_${path.replace(/\//g, "_").replace(/[{}:]/g, "")}`;
  },
});
```

**Example - Including Output Schemas:**

```typescript
const tools = createMcpFromOpenApiSpec(openApiSpec, {
  includeOutputSchemas: true, // Response schemas will be included in each tool
});
```

## Utilities

### `pathToName(path, method?)`

Convert a Hono route path to a valid MCP tool/resource name.

```typescript
import { pathToName } from "hono-openapi/mcp";

pathToName("/users");           // "users"
pathToName("/users/:id");       // "users_by_id"
pathToName("/users/:id/posts"); // "users_by_id_posts"
pathToName("/");                // "index"
pathToName("/users", "GET");    // "get_users"
pathToName("/users/:id", "POST"); // "post_users_by_id"
```

### `pathToUriTemplate(path, scheme?)`

Convert a Hono path to an MCP URI template format.

```typescript
import { pathToUriTemplate } from "hono-openapi/mcp";

pathToUriTemplate("/users");           // "hono://users"
pathToUriTemplate("/users/:id");       // "hono://users/{id}"
pathToUriTemplate("/users/:id/posts"); // "hono://users/{id}/posts"
pathToUriTemplate("/users", "api");    // "api://users"
```

### `mcpSymbol`

A unique symbol used internally to attach MCP metadata to middleware handlers. This is exposed for advanced use cases where you might want to create custom MCP middleware.

```typescript
import { mcpSymbol } from "hono-openapi/mcp";

// Creating a custom MCP middleware
function customMcpMiddleware(options) {
  const middleware = async (c, next) => {
    await next();
  };

  return Object.assign(middleware, {
    [mcpSymbol]: {
      type: "tool",
      options,
    },
  });
}
```

## Types

### Tool Types

```typescript
type McpToolOptions = {
  name: string;
  title?: string;
  description?: string;
  outputSchema?: StandardSchemaV1 | JSONSchema7;
  annotations?: McpToolAnnotations;
};

type McpToolAnnotations = {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

type McpTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema: JSONSchema7;
  outputSchema?: JSONSchema7;
  annotations?: McpToolAnnotations;
};
```

### Prompt Types

```typescript
type McpPromptOptions = {
  name: string;
  title?: string;
  description?: string;
  arguments?: McpPromptArgument[] | StandardSchemaV1;
};

type McpPromptArgument = {
  name: string;
  description?: string;
  required?: boolean;
};

type McpPrompt = {
  name: string;
  title?: string;
  description?: string;
  arguments?: McpPromptArgument[];
};
```

### Resource Types

```typescript
type McpResourceOptions = {
  name: string;
  uri: string;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: McpResourceAnnotations;
};

type McpResourceAnnotations = {
  audience?: ("user" | "assistant")[];
  priority?: number;
};

type McpResource = {
  name: string;
  uri: string;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: McpResourceAnnotations;
};
```

### Configuration Types

```typescript
type GenerateMcpOptions = {
  name: string;
  version: string;
  exclude?: string | RegExp | Array<string | RegExp>;
  excludeMethods?: string[];
  includeUnmarkedRoutes?: boolean;
};

type McpConfig = {
  serverInfo: McpServerInfo;
  tools: McpTool[];
  prompts: McpPrompt[];
  resources: McpResource[];
};

type OpenApiToMcpOptions = {
  includeTags?: string[];
  excludeTags?: string[];
  includePaths?: (string | RegExp)[];
  excludePaths?: (string | RegExp)[];
  includeMethods?: string[];
  toolNameGenerator?: (operationId: string, method: string, path: string) => string;
  includeOutputSchemas?: boolean;
};
```

## Complete Example

Here's a comprehensive example combining tools, prompts, and resources:

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { validator } from "hono-openapi";
import {
  generateMcp,
  mcpTool,
  mcpPrompt,
  mcpResource,
} from "hono-openapi/mcp";

const app = new Hono()
  // Tool: Get weather
  .post(
    "/weather",
    mcpTool({
      name: "get_weather",
      title: "Get Weather",
      description: "Get current weather for a location",
      annotations: { readOnlyHint: true },
    }),
    validator("json", z.object({
      location: z.string().describe("City name or coordinates"),
      units: z.enum(["celsius", "fahrenheit"]).optional(),
    })),
    async (c) => {
      const { location, units } = c.req.valid("json");
      return c.json({ location, temperature: 72, units: units || "fahrenheit" });
    }
  )

  // Tool: Send email
  .post(
    "/email",
    mcpTool({
      name: "send_email",
      title: "Send Email",
      description: "Send an email to a recipient",
      annotations: { destructiveHint: true, openWorldHint: true },
    }),
    validator("json", z.object({
      to: z.string().email(),
      subject: z.string(),
      body: z.string(),
    })),
    async (c) => {
      const data = c.req.valid("json");
      // ... send email
      return c.json({ success: true, messageId: "abc123" });
    }
  )

  // Prompt: Code review
  .post(
    "/prompts/review",
    mcpPrompt({
      name: "code_review",
      title: "Code Review",
      description: "Generate a code review for the provided code",
      arguments: [
        { name: "code", description: "Code to review", required: true },
        { name: "language", description: "Programming language" },
      ],
    }),
    validator("json", z.object({
      code: z.string(),
      language: z.string().optional(),
    })),
    async (c) => {
      const { code, language } = c.req.valid("json");
      return c.json({
        messages: [{
          role: "user",
          content: { type: "text", text: `Review this ${language || ""} code:\n${code}` },
        }],
      });
    }
  )

  // Resource: App configuration
  .get(
    "/config",
    mcpResource({
      name: "app_config",
      uri: "config://app",
      title: "App Configuration",
      mimeType: "application/json",
    }),
    async (c) => c.json({ version: "1.0.0", environment: "production" })
  )

  // Resource: User profile (dynamic)
  .get(
    "/users/:id",
    mcpResource({
      name: "user_profile",
      uri: "users://{id}/profile",
      title: "User Profile",
      mimeType: "application/json",
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      const { id } = c.req.valid("param");
      return c.json({ id, name: "John Doe" });
    }
  );

// Generate MCP configuration
const mcpConfig = await generateMcp(app, {
  name: "my-mcp-server",
  version: "1.0.0",
});

console.log(JSON.stringify(mcpConfig, null, 2));
```

## License

MIT
