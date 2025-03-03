import { Hono } from "hono";
import { toOpenAPIPath } from "../helper";
import { generateSpecs } from "../openapi";
import { describeRoute } from "../route";

describe("wildcard paths", () => {
  it("should handle numeric regex pattern in path parameter", async () => {
    const app = new Hono().get(
      "/:id{[0-9]+}",
      describeRoute({
        responses: {
          "200": {
            description: "OK",
          },
        },
      }),
      (c) => c.text("Hello"),
    );

    const result = await generateSpecs(app);

    // Log the entire result object
    console.log("Result for numeric regex:", JSON.stringify(result, null, 2));

    // Check if any path with 'id' is included in the OpenAPI spec
    const hasIdPath = Object.keys(result.paths || {}).some((path) =>
      path.includes("id"),
    );
    expect(hasIdPath).toBe(true);
  });

  it("should handle wildcard regex pattern in path parameter", async () => {
    const app = new Hono().get(
      "/:url{.*}",
      describeRoute({
        responses: {
          "200": {
            description: "OK",
          },
        },
      }),
      (c) => c.text("Hello"),
    );

    const result = await generateSpecs(app);

    // Log the entire result object
    console.log("Result for wildcard regex:", JSON.stringify(result, null, 2));

    // Check if any path with 'url' is included in the OpenAPI spec
    const hasUrlPath = Object.keys(result.paths || {}).some((path) =>
      path.includes("url"),
    );
    expect(hasUrlPath).toBe(true);
  });

  it("should handle multiple regex patterns in path parameters", async () => {
    const app = new Hono().get(
      "/:category{[a-z]+}/:id{[0-9]+}",
      describeRoute({
        responses: {
          "200": {
            description: "OK",
          },
        },
      }),
      (c) => c.text("Hello"),
    );

    const result = await generateSpecs(app);

    // Log the actual paths being generated
    console.log("Paths for multiple regex:", Object.keys(result.paths || {}));

    // Check if any path with 'category' and 'id' is included in the OpenAPI spec
    const hasCategoryAndIdPath = Object.keys(result.paths || {}).some(
      (path) => path.includes("category") && path.includes("id"),
    );
    expect(hasCategoryAndIdPath).toBe(true);
  });

  describe("toOpenAPIPath function", () => {
    it("should correctly convert path with regex pattern", () => {
      expect(toOpenAPIPath("/:id{[0-9]+}")).toBe("/{id}");
      expect(toOpenAPIPath("/:url{.*}")).toBe("/{url}");
      expect(toOpenAPIPath("/:category{[a-z]+}/:id{[0-9]+}")).toBe(
        "/{category}/{id}",
      );
    });

    it("should handle optional parameters", () => {
      expect(toOpenAPIPath("/:id?")).toBe("/{id}");
      expect(toOpenAPIPath("/:url{.*}?")).toBe("/{url}");
    });
  });
});
