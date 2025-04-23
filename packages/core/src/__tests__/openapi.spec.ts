import { Hono } from "hono";
import { openAPISpecs } from "../openapi";
import yaml from "yaml";

describe("OpenAPI Specs Generation", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  it("should generate OpenAPI specs in JSON format", async () => {
    const c = {
      json: jest.fn(),
    };

    const handler = openAPISpecs(app, { format: "json" });
    await handler(c as any);

    expect(c.json).toHaveBeenCalledWith(expect.any(Object));
  });

  it("should generate OpenAPI specs in YAML format", async () => {
    const c = {
      text: jest.fn(),
    };

    const handler = openAPISpecs(app, { format: "yaml" });
    await handler(c as any);

    expect(c.text).toHaveBeenCalledWith(expect.any(String), 200, {
      "Content-Type": "application/x-yaml",
    });

    const yamlSpecs = c.text.mock.calls[0][0];
    expect(() => yaml.parse(yamlSpecs)).not.toThrow();
  });
});
