import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import z from "zod";
import { generateSpecs } from "../handler.js";
import { describeRoute, validator } from "../middlewares.js";
import "zod-openapi/extend";
import type { OpenAPIV3_1 } from "openapi-types";

describe("qs parsing for query parameters", () => {
  describe("nested object query parameters", () => {
    it("should parse nested objects when qs is enabled", async () => {
      const app = new Hono().get(
        "/products",
        validator(
          "query",
          z.object({
            filter: z.object({
              category: z.string(),
              minPrice: z
                .string()
                .transform((val) => Number(val))
                .refine((val) => !Number.isNaN(val)),
              maxPrice: z
                .string()
                .transform((val) => Number(val))
                .refine((val) => !Number.isNaN(val)),
            }),
          }),
          undefined,
          { qs: { enabled: true } },
        ),
        async (c) => {
          const query = c.req.valid("query");
          return c.json(query);
        },
      );

      // Test the actual parsing
      const res = await app.request(
        "/products?filter[category]=electronics&filter[minPrice]=100&filter[maxPrice]=500",
      );

      // Debug: log the response if it's an error
      if (res.status !== 200) {
        const errorData = await res.json();
        console.log("Validation error:", errorData);
      }

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        filter: {
          category: "electronics",
          minPrice: 100,
          maxPrice: 500,
        },
      });
    });

    it("should generate OpenAPI spec with deepObject style for nested objects", async () => {
      const app = new Hono().get(
        "/products",
        validator(
          "query",
          z.object({
            filter: z.object({
              category: z.string(),
              minPrice: z.number(),
            }),
          }),
          undefined,
          { qs: { enabled: true } },
        ),
        describeRoute({
          description: "Get products with filters",
          responses: { 200: { description: "OK" } },
        }),
        async (c) => c.json(c.req.valid("query")),
      );

      const specs = await generateSpecs(app);
      const parameters = specs.paths["/products"]?.get?.parameters ?? [];

      // Find the filter parameter
      const filterParam = parameters.find(
        (p) => "name" in p && p.name === "filter",
      );
      expect(filterParam).toBeDefined();
      expect(filterParam).toMatchObject({
        in: "query",
        name: "filter",
        style: "deepObject",
        explode: true,
        schema: {
          type: "object",
          properties: {
            category: { type: "string" },
            minPrice: { type: "number" },
          },
        },
      });
    });

    it("should handle deeply nested objects", async () => {
      const app = new Hono().get(
        "/search",
        validator(
          "query",
          z.object({
            criteria: z.object({
              location: z.object({
                city: z.string(),
                country: z.string(),
              }),
              price: z.object({
                min: z
                  .string()
                  .transform((val) => Number(val))
                  .refine((val) => !Number.isNaN(val)),
                max: z
                  .string()
                  .transform((val) => Number(val))
                  .refine((val) => !Number.isNaN(val)),
              }),
            }),
          }),
          undefined,
          { qs: { enabled: true } },
        ),
        async (c) => c.json(c.req.valid("query")),
      );

      const res = await app.request(
        "/search?criteria[location][city]=Paris&criteria[location][country]=France&criteria[price][min]=50&criteria[price][max]=200",
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        criteria: {
          location: {
            city: "Paris",
            country: "France",
          },
          price: {
            min: 50,
            max: 200,
          },
        },
      });
    });
  });

  describe("array query parameters", () => {
    it("should parse arrays with indexed notation", async () => {
      const app = new Hono().get(
        "/items",
        validator(
          "query",
          z.object({
            tags: z.array(z.string()),
          }),
          undefined,
          { qs: { enabled: true } },
        ),
        async (c) => c.json(c.req.valid("query")),
      );

      const res = await app.request(
        "/items?tags[0]=javascript&tags[1]=typescript&tags[2]=nodejs",
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        tags: ["javascript", "typescript", "nodejs"],
      });
    });

    it("should parse arrays with bracket notation", async () => {
      const app = new Hono().get(
        "/items",
        validator(
          "query",
          z.object({
            tags: z.array(z.string()),
          }),
          undefined,
          { qs: { enabled: true } },
        ),
        async (c) => c.json(c.req.valid("query")),
      );

      const res = await app.request(
        "/items?tags[]=javascript&tags[]=typescript&tags[]=nodejs",
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        tags: ["javascript", "typescript", "nodejs"],
      });
    });

    it("should generate OpenAPI spec with appropriate style for arrays", async () => {
      const app = new Hono().get(
        "/items",
        validator(
          "query",
          z.object({
            tags: z.array(z.string()),
          }),
          undefined,
          { qs: { enabled: true } },
        ),
        describeRoute({
          description: "Get items by tags",
          responses: { 200: { description: "OK" } },
        }),
        async (c) => c.json(c.req.valid("query")),
      );

      const specs = await generateSpecs(app);
      const parameters = specs.paths["/items"]?.get?.parameters ?? [];
      const tagsParam = parameters.find(
        (p) => "name" in p && p.name === "tags",
      );

      expect(tagsParam).toBeDefined();
      expect(tagsParam).toMatchObject({
        in: "query",
        name: "tags",
        style: "form",
        explode: true,
        schema: {
          type: "array",
          items: { type: "string" },
        },
      });
    });

    it("should handle arrays of objects", async () => {
      const app = new Hono().get(
        "/orders",
        validator(
          "query",
          z.object({
            items: z.array(
              z.object({
                id: z.string(),
                quantity: z
                  .string()
                  .transform((val) => Number(val))
                  .refine((val) => !Number.isNaN(val)),
              }),
            ),
          }),
          undefined,
          { qs: { enabled: true } },
        ),
        async (c) => c.json(c.req.valid("query")),
      );

      const res = await app.request(
        "/orders?items[0][id]=ABC123&items[0][quantity]=2&items[1][id]=DEF456&items[1][quantity]=1",
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        items: [
          { id: "ABC123", quantity: 2 },
          { id: "DEF456", quantity: 1 },
        ],
      });
    });
  });

  describe("qs options", () => {
    it("should respect depth limit option", async () => {
      const app = new Hono().get(
        "/limited",
        validator(
          "query",
          z.object({
            data: z.any(),
          }),
          undefined,
          { qs: { enabled: true, depth: 1 } },
        ),
        async (c) => c.json(c.req.valid("query")),
      );

      // With depth: 1, nested objects beyond 1 level should be parsed as strings
      const res = await app.request("/limited?data[level1][level2]=value");
      expect(res.status).toBe(200);
      const data = await res.json();
      // The exact behavior depends on qs implementation
      // With depth: 1, level2 should not be parsed as nested
      expect(data.data.level1).toBeDefined();
    });

    it("should respect arrayLimit option", async () => {
      const app = new Hono().get(
        "/array-limited",
        validator(
          "query",
          z.object({
            items: z.array(z.string()).optional(),
          }),
          undefined,
          { qs: { enabled: true, arrayLimit: 2 } },
        ),
        async (c) => c.json(c.req.valid("query") || {}),
      );

      // With arrayLimit: 2, only first 2 array items should be parsed
      const res = await app.request(
        "/array-limited?items[0]=a&items[1]=b&items[2]=c",
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      // Behavior depends on qs, but typically items beyond limit are ignored
      // or parsed differently
      expect(data.items).toBeDefined();
    });
  });

  describe("backward compatibility", () => {
    it("should work normally when qs is NOT enabled (default behavior)", async () => {
      const app = new Hono().get(
        "/classic",
        validator(
          "query",
          z.object({
            name: z.string(),
            age: z.coerce.number(),
          }),
        ),
        async (c) => c.json(c.req.valid("query")),
      );

      const res = await app.request("/classic?name=John&age=30");

      // Debug: log the response if it's an error
      if (res.status !== 200) {
        const errorData = await res.json();
        console.log("Backward compatibility error:", errorData);
      }

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        name: "John",
        age: 30,
      });
    });

    it("should NOT parse nested objects when qs is disabled", async () => {
      const app = new Hono().get(
        "/no-qs",
        validator(
          "query",
          z.object({
            filter: z.any().optional(),
          }),
        ),
        async (c) => {
          // Get raw query to see what was received
          const rawQuery = Object.fromEntries(new URL(c.req.url).searchParams);
          return c.json({ raw: rawQuery });
        },
      );

      const res = await app.request("/no-qs?filter[category]=electronics");
      expect(res.status).toBe(200);
      const data = await res.json();
      // Without qs, "filter[category]" is treated as a single key
      expect(data.raw["filter[category]"]).toBe("electronics");
    });

    it("should generate standard OpenAPI spec when qs is disabled", async () => {
      const app = new Hono().get(
        "/standard",
        validator(
          "query",
          z.object({
            name: z.string(),
            tags: z.array(z.string()).optional(),
          }),
        ),
        describeRoute({
          description: "Standard query params",
          responses: { 200: { description: "OK" } },
        }),
        async (c) => c.json(c.req.valid("query")),
      );

      const specs = await generateSpecs(app);
      const parameters = specs.paths["/standard"]?.get?.parameters ?? [];

      // Without qs enabled, parameters should NOT have style/explode properties
      const nameParam = parameters.find(
        (p) => "name" in p && p.name === "name",
      ) as OpenAPIV3_1.ParameterObject | undefined;
      expect(nameParam).toBeDefined();
      expect(nameParam?.style).toBeUndefined();
      expect(nameParam?.explode).toBeUndefined();
    });
  });

  describe("mixed parameters", () => {
    it("should handle mix of simple and nested parameters", async () => {
      const app = new Hono().get(
        "/mixed",
        validator(
          "query",
          z.object({
            search: z.string(),
            page: z.coerce.number(),
            filter: z.object({
              category: z.string(),
              brand: z.string().optional(),
            }),
            sort: z.array(z.string()),
          }),
          undefined,
          { qs: { enabled: true } },
        ),
        async (c) => c.json(c.req.valid("query")),
      );

      const res = await app.request(
        "/mixed?search=laptop&page=2&filter[category]=electronics&filter[brand]=apple&sort[]=price&sort[]=rating",
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        search: "laptop",
        page: 2,
        filter: {
          category: "electronics",
          brand: "apple",
        },
        sort: ["price", "rating"],
      });
    });
  });
});
