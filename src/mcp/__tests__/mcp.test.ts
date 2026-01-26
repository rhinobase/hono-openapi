import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateSpecs } from "../../handler.js";
import { validator } from "../../middlewares.js";
import { createMcpFromOpenApiSpec } from "../from-openapi.js";
import { generateMcp } from "../generator.js";
import { mcpPrompt, mcpResource, mcpTool } from "../middlewares.js";
import {
  extractUriParameters,
  isUriTemplate,
  mcpSymbol,
  pathToName,
  pathToUriTemplate,
} from "../utils.js";

describe("MCP Utils", () => {
  describe("pathToName", () => {
    it("should convert simple path to name", () => {
      expect(pathToName("/users")).toBe("users");
    });

    it("should convert path with parameters", () => {
      expect(pathToName("/users/:id")).toBe("users_by_id");
    });

    it("should convert nested path", () => {
      expect(pathToName("/users/:id/posts/:postId")).toBe(
        "users_by_id_posts_by_postId",
      );
    });

    it("should handle root path", () => {
      expect(pathToName("/")).toBe("index");
    });

    it("should prepend method when provided", () => {
      expect(pathToName("/users", "GET")).toBe("get_users");
      expect(pathToName("/users/:id", "POST")).toBe("post_users_by_id");
    });

    it("should handle root path with method", () => {
      expect(pathToName("/", "GET")).toBe("get_index");
    });
  });

  describe("pathToUriTemplate", () => {
    it("should convert simple path", () => {
      expect(pathToUriTemplate("/users")).toBe("hono://users");
    });

    it("should convert path with parameters", () => {
      expect(pathToUriTemplate("/users/:id")).toBe("hono://users/{id}");
    });

    it("should use custom scheme", () => {
      expect(pathToUriTemplate("/users", "api")).toBe("api://users");
    });
  });

  describe("extractUriParameters", () => {
    it("should extract parameters from URI template", () => {
      expect(extractUriParameters("users/{userId}/posts/{postId}")).toEqual([
        "userId",
        "postId",
      ]);
    });

    it("should return empty array for no parameters", () => {
      expect(extractUriParameters("users/list")).toEqual([]);
    });
  });

  describe("isUriTemplate", () => {
    it("should return true for templates", () => {
      expect(isUriTemplate("users/{id}")).toBe(true);
    });

    it("should return false for static URIs", () => {
      expect(isUriTemplate("users/list")).toBe(false);
    });
  });
});

describe("MCP Middlewares", () => {
  it("should create mcpTool middleware with metadata", () => {
    const middleware = mcpTool({
      name: "test_tool",
      title: "Test Tool",
      description: "A test tool",
    });

    expect(typeof middleware).toBe("function");
    // Check the MCP marker is attached
    const marker = (middleware as unknown as Record<symbol, unknown>)[
      mcpSymbol
    ];
    expect(marker).toBeDefined();
    expect(marker).toHaveProperty("type", "tool");
    expect(marker).toHaveProperty("options");
  });

  it("should create mcpPrompt middleware with metadata", () => {
    const middleware = mcpPrompt({
      name: "test_prompt",
      title: "Test Prompt",
      description: "A test prompt",
      arguments: [{ name: "input", required: true }],
    });

    expect(typeof middleware).toBe("function");
  });

  it("should create mcpResource middleware with metadata", () => {
    const middleware = mcpResource({
      name: "test_resource",
      uri: "config://app",
      title: "Test Resource",
      mimeType: "application/json",
    });

    expect(typeof middleware).toBe("function");
  });
});

describe("generateMcp", () => {
  it("should generate MCP config with tools", async () => {
    const app = new Hono().post(
      "/weather",
      mcpTool({
        name: "get_weather",
        title: "Get Weather",
        description: "Get current weather for a location",
      }),
      validator("json", z.object({ location: z.string() })),
      async (c) => c.json({ temperature: 72, condition: "sunny" }),
    );

    const config = await generateMcp(app, {
      name: "test-server",
      version: "1.0.0",
    });

    expect(config.serverInfo.name).toBe("test-server");
    expect(config.serverInfo.version).toBe("1.0.0");
    expect(config.tools).toHaveLength(1);
    expect(config.tools[0].name).toBe("get_weather");
    expect(config.tools[0].title).toBe("Get Weather");
    expect(config.tools[0].description).toBe(
      "Get current weather for a location",
    );
    expect(config.tools[0].inputSchema).toBeDefined();
  });

  it("should generate MCP config with prompts", async () => {
    const app = new Hono().post(
      "/review",
      mcpPrompt({
        name: "code_review",
        title: "Code Review",
        description: "Review code for best practices",
        arguments: [
          { name: "code", description: "Code to review", required: true },
        ],
      }),
      async (c) =>
        c.json({
          messages: [
            {
              role: "user",
              content: { type: "text", text: "Review this code..." },
            },
          ],
        }),
    );

    const config = await generateMcp(app, {
      name: "test-server",
      version: "1.0.0",
    });

    expect(config.prompts).toHaveLength(1);
    expect(config.prompts[0].name).toBe("code_review");
    expect(config.prompts[0].title).toBe("Code Review");
    expect(config.prompts[0].arguments).toHaveLength(1);
  });

  it("should generate MCP config with resources", async () => {
    const app = new Hono().get(
      "/config",
      mcpResource({
        name: "app_config",
        uri: "config://app",
        title: "Application Config",
        mimeType: "application/json",
      }),
      async (c) => c.json({ theme: "dark" }),
    );

    const config = await generateMcp(app, {
      name: "test-server",
      version: "1.0.0",
    });

    expect(config.resources).toHaveLength(1);
    expect(config.resources[0].name).toBe("app_config");
    expect(config.resources[0].uri).toBe("config://app");
    expect(config.resources[0].mimeType).toBe("application/json");
  });

  it("should exclude specified paths", async () => {
    const app = new Hono()
      .post(
        "/weather",
        mcpTool({ name: "get_weather", description: "Get weather" }),
        async (c) => c.json({}),
      )
      .post(
        "/internal/admin",
        mcpTool({ name: "admin_tool", description: "Admin only" }),
        async (c) => c.json({}),
      );

    const config = await generateMcp(app, {
      name: "test-server",
      version: "1.0.0",
      exclude: ["/internal/admin"],
    });

    expect(config.tools).toHaveLength(1);
    expect(config.tools[0].name).toBe("get_weather");
  });

  it("should exclude specified methods", async () => {
    const app = new Hono()
      .get(
        "/data",
        mcpTool({ name: "get_data", description: "Get data" }),
        async (c) => c.json({}),
      )
      .options(
        "/data",
        mcpTool({ name: "options_data", description: "Options" }),
        async (c) => c.json({}),
      );

    const config = await generateMcp(app, {
      name: "test-server",
      version: "1.0.0",
      excludeMethods: ["OPTIONS"],
    });

    expect(config.tools).toHaveLength(1);
    expect(config.tools[0].name).toBe("get_data");
  });

  it("should handle routes with both OpenAPI and MCP markers", async () => {
    const app = new Hono().post(
      "/search",
      mcpTool({
        name: "search",
        description: "Search the database",
      }),
      validator("json", z.object({ query: z.string() })),
      async (c) => c.json({ results: [] }),
    );

    const mcpConfig = await generateMcp(app, {
      name: "test-server",
      version: "1.0.0",
    });

    expect(mcpConfig.tools).toHaveLength(1);
    expect(mcpConfig.tools[0].name).toBe("search");
    expect(mcpConfig.tools[0].inputSchema).toBeDefined();
  });
});

describe("createMcpFromOpenApiSpec", () => {
  it("should convert OpenAPI spec to MCP tools", async () => {
    const app = new Hono().get(
      "/users/:id",
      validator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      async (c) => c.json({ id: c.req.param("id"), name: "Test User" }),
    );

    const openApiSpec = await generateSpecs(app, {
      documentation: {
        info: {
          title: "Test API",
          version: "1.0.0",
        },
      },
    });

    const tools = createMcpFromOpenApiSpec(openApiSpec);

    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].name).toBeDefined();
    expect(tools[0].inputSchema).toBeDefined();
  });

  it("should filter by tags", async () => {
    const spec = {
      openapi: "3.1.0" as const,
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/public": {
          get: {
            operationId: "getPublic",
            tags: ["public"],
            responses: { "200": { description: "OK" } },
          },
        },
        "/private": {
          get: {
            operationId: "getPrivate",
            tags: ["private"],
            responses: { "200": { description: "OK" } },
          },
        },
      },
    };

    const tools = createMcpFromOpenApiSpec(spec, {
      includeTags: ["public"],
    });

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("getPublic");
  });

  it("should exclude by tags", async () => {
    const spec = {
      openapi: "3.1.0" as const,
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/public": {
          get: {
            operationId: "getPublic",
            tags: ["public"],
            responses: { "200": { description: "OK" } },
          },
        },
        "/internal": {
          get: {
            operationId: "getInternal",
            tags: ["internal"],
            responses: { "200": { description: "OK" } },
          },
        },
      },
    };

    const tools = createMcpFromOpenApiSpec(spec, {
      excludeTags: ["internal"],
    });

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("getPublic");
  });

  it("should use custom tool name generator", async () => {
    const spec = {
      openapi: "3.1.0" as const,
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/users": {
          get: {
            operationId: "getUsers",
            responses: { "200": { description: "OK" } },
          },
        },
      },
    };

    const tools = createMcpFromOpenApiSpec(spec, {
      toolNameGenerator: (operationId, method, _path) =>
        `custom_${method}_${operationId}`,
    });

    expect(tools[0].name).toBe("custom_get_getUsers");
  });

  it("should extract parameters as input schema", async () => {
    const spec = {
      openapi: "3.1.0" as const,
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/users/{id}": {
          get: {
            operationId: "getUserById",
            parameters: [
              {
                name: "id",
                in: "path" as const,
                required: true,
                schema: { type: "string" as const },
              },
            ],
            responses: { "200": { description: "OK" } },
          },
        },
      },
    };

    const tools = createMcpFromOpenApiSpec(spec);

    expect(tools[0].inputSchema.properties).toHaveProperty("id");
    expect(tools[0].inputSchema.required).toContain("id");
  });

  it("should extract request body as input schema", async () => {
    const spec = {
      openapi: "3.1.0" as const,
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/users": {
          post: {
            operationId: "createUser",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object" as const,
                    properties: {
                      name: { type: "string" as const },
                      email: { type: "string" as const },
                    },
                    required: ["name", "email"],
                  },
                },
              },
            },
            responses: { "201": { description: "Created" } },
          },
        },
      },
    };

    const tools = createMcpFromOpenApiSpec(spec);

    expect(tools[0].inputSchema.properties).toHaveProperty("name");
    expect(tools[0].inputSchema.properties).toHaveProperty("email");
    expect(tools[0].inputSchema.required).toContain("name");
    expect(tools[0].inputSchema.required).toContain("email");
  });

  it("should include output schemas when enabled", async () => {
    const spec = {
      openapi: "3.1.0" as const,
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/users": {
          get: {
            operationId: "getUsers",
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: {
                      type: "array" as const,
                      items: {
                        type: "object" as const,
                        properties: {
                          id: { type: "string" as const },
                          name: { type: "string" as const },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const tools = createMcpFromOpenApiSpec(spec, {
      includeOutputSchemas: true,
    });

    expect(tools[0].outputSchema).toBeDefined();
    expect(tools[0].outputSchema?.type).toBe("array");
  });
});
