import { createSchema } from "../index";
import * as v from "valibot";

describe("createSchema", () => {
  it("should create a schema", () => {
    const expected = {
      schema: {
        type: "string",
        description: "foo",
      },
    };

    const schema = v.pipe(v.string(), v.metadata({ description: "foo" }));

    const result = createSchema(schema);

    expect(result).toStrictEqual(expected);
  });

  it("should create a registered schema", () => {
    const expected = {
      schema: {
        $ref: "#/components/schemas/String",
      },
      components: {
        String: {
          type: "string",
          description: "foo",
        },
      },
    };

    const schema = v.pipe(
      v.string(),
      v.metadata({ description: "foo", ref: "String" })
    );

    const result = createSchema(schema);

    expect(result).toStrictEqual(expected);
  });

  it("should create components", () => {
    const expected = {
      schema: {
        type: "object",
        properties: {
          foo: {
            $ref: "#/components/schemas/foo",
          },
        },
        required: ["foo"],
      },
      components: {
        foo: {
          type: "string",
          description: "foo",
        },
      },
    };

    const schema = v.object({
      foo: v.pipe(v.string(), v.metadata({ description: "foo", ref: "foo" })),
    });

    const result = createSchema(schema);

    expect(result).toStrictEqual(expected);
  });

  it("should support componentRefPath", () => {
    const expected = {
      schema: {
        $ref: "#/definitions/String",
      },
      components: {
        String: {
          type: "string",
          description: "foo",
        },
      },
    };

    const schema = v.pipe(
      v.string(),
      v.metadata({ description: "foo", ref: "String" })
    );

    const result = createSchema(schema, {
      componentRefPath: "#/definitions/",
    });

    expect(result).toStrictEqual(expected);
  });
});
