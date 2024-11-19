import * as v from "valibot";
import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { createSchema } from "..";

type Schema = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
type Schema3_1 = OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject;

describe("Create string schema", () => {
  it("creates a simple string schema", () => {
    const expected: Schema = {
      type: "string",
    };

    const schema = v.string();

    const result = createSchema(schema);

    expect(result.schema).toEqual(expected);
  });

  it("creates a string schema with a regex pattern", () => {
    const expected: Schema = {
      type: "string",
      pattern: "^hello",
    };

    const schema = v.pipe(v.string(), v.regex(/^hello/));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a string schema with a startsWith pattern", () => {
    const expected: Schema = {
      type: "string",
      pattern: "^hello",
    };

    const schema = v.pipe(v.string(), v.startsWith("hello"));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a string schema with an endsWith pattern", () => {
    const expected: Schema = {
      type: "string",
      pattern: "hello$",
    };

    const schema = v.pipe(v.string(), v.endsWith("hello"));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a string schema with an includes pattern", () => {
    const expected: Schema = {
      type: "string",
      pattern: "hello",
    };
    const schema = v.pipe(v.string(), v.includes("hello"));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it.skip("creates a string schema with multiple patterns and length checks", () => {
    const expected: Schema = {
      allOf: [
        {
          type: "string",
          pattern: "^foo",
          minLength: 10,
        },
        {
          type: "string",
          pattern: "foo$",
        },
        {
          type: "string",
          pattern: "^hello",
        },
        {
          type: "string",
          pattern: "hello",
        },
      ],
    };

    const schema = v.pipe(
      v.string(),
      v.minLength(10),
      v.includes("hello"),
      v.startsWith("hello"),
      v.regex(/^foo/),
      v.regex(/foo$/)
    );

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a string schema with min and max", () => {
    const expected: Schema = {
      type: "string",
      minLength: 0,
      maxLength: 1,
    };
    const schema = v.pipe(v.string(), v.minLength(0), v.maxLength(1));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a string schema with nonempty", () => {
    const expected: Schema = {
      type: "string",
      minLength: 1,
    };

    const schema = v.pipe(v.string(), v.nonEmpty());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a string schema with a set length", () => {
    const expected: Schema = {
      type: "string",
      minLength: 1,
      maxLength: 1,
    };
    const schema = v.pipe(v.string(), v.length(1));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it.each`
    schema                                 | format
    ${v.pipe(v.string(), v.uuid())}        | ${"uuid"}
    ${v.pipe(v.string(), v.email())}       | ${"email"}
    ${v.pipe(v.string(), v.url())}         | ${"uri"}
    ${v.pipe(v.string(), v.isoDateTime())} | ${"date-time"}
    ${v.date()}                            | ${"date"}
    ${v.pipe(v.string(), v.isoTime())}     | ${"time"}
  `(
    "creates a string schema with $format",
    ({ schema, format }: { schema: v.GenericSchema; format: string }) => {
      const expected: Schema = {
        type: "string",
        format,
      };

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    }
  );

  it("supports contentEncoding in 3.1.0", () => {
    const expected: Schema3_1 = {
      type: "string",
      // @ts-ignore
      contentEncoding: "base64",
    };

    const schema = v.pipe(v.string(), v.base64());

    const result = createSchema(schema, { version: "3.1.0" });

    expect(result.schema).toStrictEqual(expected);
  });

  it("does not support contentEncoding in 3.0.0", () => {
    const expected: Schema = {
      type: "string",
    };

    const schema = v.pipe(v.string(), v.base64());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});

describe("Create number schema", () => {
  it("creates a simple number schema", () => {
    const expected: Schema = {
      type: "number",
    };
    const schema = v.number();

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a integer schema", () => {
    const expected: Schema = {
      type: "integer",
    };
    const schema = v.pipe(v.number(), v.integer());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it.skip("creates a number schema with lt or gt", () => {
    const expected: Schema = {
      type: "number",
      // @ts-expect-error
      exclusiveMinimum: 0,
      // @ts-expect-error
      exclusiveMaximum: 10,
    };

    // const schema = z.number().lt(10).gt(0);
    const schema = v.number();

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it.skip("creates a number schema with lte or gte", () => {
    const expected: Schema = {
      type: "number",
      minimum: 0,
      maximum: 10,
    };

    // const schema = z.number().lte(10).gte(0);
    const schema = v.number();

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it.skip("creates a number schema with lte or gte in openapi 3.0.0", () => {
    const expected: Schema = {
      type: "number",
      minimum: 0,
      maximum: 10,
    };

    // const schema = z.number().lte(10).gte(0);
    const schema = v.number();

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it.skip("creates a number schema with lt or gt in openapi 3.0.0", () => {
    const expected: Schema = {
      type: "number",
      minimum: 0,
      exclusiveMinimum: true,
      maximum: 10,
      exclusiveMaximum: true,
    };

    // const schema = z.number().lt(10).gt(0);
    const schema = v.number();

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("supports multipleOf", () => {
    const expected: Schema = {
      type: "number",
      multipleOf: 2,
    };
    const schema = v.pipe(v.number(), v.multipleOf(2));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});

describe("Create boolean cchema", () => {
  it("creates a boolean schema", () => {
    const expected: Schema = {
      type: "boolean",
    };
    const schema = v.boolean();

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});

describe("Create branded schema", () => {
  it("supports branded schema", () => {
    const expected: Schema = {
      type: "object",
      properties: {
        name: {
          type: "string",
        },
      },
      required: ["name"],
    };

    const schema = v.pipe(v.object({ name: v.string() }), v.brand("Cat"));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});

describe("Create array schema", () => {
  it("creates simple arrays", () => {
    const expected: Schema = {
      type: "array",
      items: {
        type: "string",
      },
    };
    const schema = v.array(v.string());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates min and max", () => {
    const expected: Schema = {
      type: "array",
      items: {
        type: "string",
      },
      minItems: 0,
      maxItems: 10,
    };

    const schema = v.pipe(v.array(v.string()), v.minLength(0), v.maxLength(10));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates exact length", () => {
    const expected: Schema = {
      type: "array",
      items: {
        type: "string",
      },
      minItems: 10,
      maxItems: 10,
    };

    const schema = v.pipe(v.array(v.string()), v.length(10));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});

describe("Create catch schema", () => {
  it("creates a default string schema for a string with a catch", () => {
    const expected: Schema = {
      type: "string",
      default: "bob",
    };

    const schema = v.fallback(v.string(), "bob");

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});

describe("Create default schema", () => {
  it("creates a default string schema", () => {
    const expected: Schema = {
      type: "string",
      default: "a",
    };

    const schema = v.optional(v.string(), "a");

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it.skip("adds a default property to a registered schema", () => {
    const expected: Schema = {
      allOf: [
        {
          $ref: "#/components/schemas/ref",
        },
      ],
      default: "a",
    };

    const schema = v.optional(
      v.pipe(v.string(), v.metadata({ ref: "ref" })),
      "a"
    );

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});

describe("Create optional schema", () => {
  it("creates a simple string schema for an optional string", () => {
    const expected: Schema = {
      type: "string",
    };
    const schema = v.optional(v.string());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});

describe("Create enum schema", () => {
  it.skip("creates a string enum schema", () => {
    const expected: Schema = {
      type: "string",
      enum: ["a", "b"],
    };

    const schema = v.picklist(["a", "b"]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});

describe("Create native enum schema", () => {
  it.skip("creates a string schema from a string enum", () => {
    const expected: Schema = {
      type: "string",
      enum: ["Up", "Down", "Left", "Right"],
    };

    enum Direction {
      Up = "Up",
      Down = "Down",
      Left = "Left",
      Right = "Right",
    }

    const schema = v.enum(Direction);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it.skip("creates a number schema from an number enum", () => {
    const expected: Schema = {
      type: "number",
      enum: [0, 1, 2, 3],
    };

    // biome-ignore lint/style/useEnumInitializers: <explanation>
    enum Direction {
      Up,
      Down,
      Left,
      Right,
    }
    const schema = v.enum(Direction);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it.skip("creates a string and number schema from a mixed enum", () => {
    const expected: Schema3_1 = {
      type: ["string", "number"],
      enum: ["Right", 0, 1, 2],
    };

    // biome-ignore lint/style/useEnumInitializers: <explanation>
    enum Direction {
      Up,
      Down,
      Left,
      Right = "Right",
    }

    const schema = v.enum(Direction);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it.skip("creates a oneOf string and number schema from a mixed enum in openapi 3.0.0", () => {
    const expected: Schema = {
      oneOf: [
        {
          type: "string",
          enum: ["Right"],
        },
        {
          type: "number",
          enum: [0, 1, 2],
        },
      ],
    };

    // biome-ignore lint/style/useEnumInitializers: <explanation>
    enum Direction {
      Up,
      Down,
      Left,
      Right = "Right",
    }

    const schema = v.enum(Direction);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});

describe("Create manual type schema", () => {
  it.skip("creates a simple string schema for an optional string", () => {
    const expected: Schema = {
      type: "string",
    };

    const schema = v.pipe(v.unknown(), v.metadata({ type: "string" }));

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});

describe.skip("Create literal schema", () => {
  describe("OpenAPI 3.1.0", () => {
    it("creates a string const schema", () => {
      const expected: Schema3_1 = {
        type: "string",
        const: "a",
      };

      const schema = v.literal("a");

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates a number const schema", () => {
      const expected: Schema3_1 = {
        type: "number",
        const: 2,
      };

      const schema = v.literal(2);

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates a boolean const schema", () => {
      const expected: Schema3_1 = {
        type: "boolean",
        const: true,
      };

      const schema = v.literal(true);

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });
  });

  describe("OpenAPI 3.0.0", () => {
    it("creates a string enum schema", () => {
      const expected: Schema = {
        type: "string",
        enum: ["a"],
      };

      const schema = v.literal("a");

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates a number enum schema", () => {
      const expected: Schema = {
        type: "number",
        enum: [2],
      };

      const schema = v.literal(2);

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates a boolean enum schema", () => {
      const expected: Schema = {
        type: "boolean",
        enum: [true],
      };

      const schema = v.literal(true);

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });
  });
});

describe("Create nullable schema", () => {
  describe("openapi 3.0.0", () => {
    it("creates a simple nullable string schema", () => {
      const expected: Schema = {
        type: "string",
        nullable: true,
      };

      const schema = v.nullable(v.string());

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates an allOf nullable schema for registered schemas", () => {
      const expected: Schema = {
        allOf: [{ $ref: "#/components/schemas/a" }],
        nullable: true,
      };

      const registered = v.pipe(v.string(), v.metadata({ ref: "a" }));
      const schema = v.nullable(v.optional(registered));

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates an anyOf nullable schema", () => {
      const expected: Schema = {
        anyOf: [
          {
            type: "object",
            properties: {
              a: {
                type: "string",
              },
            },
            required: ["a"],
          },
          {
            type: "object",
            properties: {
              b: {
                type: "string",
              },
            },
            required: ["b"],
          },
        ],
        nullable: true,
      };

      const schema = v.nullable(
        v.union([v.object({ a: v.string() }), v.object({ b: v.string() })])
      );

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates a nullable allOf nullable schema", () => {
      const expected: Schema = {
        type: "object",
        properties: {
          b: {
            allOf: [{ $ref: "#/components/schemas/a" }],
            properties: { b: { type: "string" } },
            required: ["b"],
            nullable: true,
          },
        },
        required: ["b"],
        nullable: true,
      };

      const object1 = v.pipe(
        v.object({ a: v.string() }),
        v.metadata({ ref: "a" })
      );
      const object2 = v.object({
        ...object1.entries,
        b: v.string(),
      });
      const schema = v.nullable(v.object({ b: v.nullable(object2) }));

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates a nullable enum", () => {
      const expected: Schema = {
        type: "string",
        nullable: true,
        enum: ["a", null],
      };

      const schema = v.nullable(v.picklist(["a"]));

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });
  });

  describe("openapi 3.1.0", () => {
    it("creates a simple nullable string schema", () => {
      const expected: Schema3_1 = {
        type: ["string", "null"],
      };

      const schema = v.nullable(v.string());

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates an oneOf nullable schema for registered schemas", () => {
      const expected: Schema = {
        oneOf: [
          {
            $ref: "#/components/schemas/a",
          },
          {
            type: "null",
          },
        ],
      };

      const registered = v.pipe(v.string(), v.metadata({ ref: "a" }));
      const schema = v.nullable(v.optional(registered));

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates an anyOf nullable schema", () => {
      const expected: Schema = {
        anyOf: [
          {
            type: "object",
            properties: {
              a: {
                type: "string",
              },
            },
            required: ["a"],
          },
          {
            type: "object",
            properties: {
              b: {
                type: "string",
              },
            },
            required: ["b"],
          },
          {
            type: "null",
          },
        ],
      };

      const schema = v.nullable(
        v.union([v.object({ a: v.string() }), v.object({ b: v.string() })])
      );

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates a nullable allOf nullable schema", () => {
      const expected: Schema = {
        type: ["object", "null"],
        properties: {
          b: {
            oneOf: [
              {
                allOf: [{ $ref: "#/components/schemas/a" }],
                properties: { b: { type: "string" } },
                required: ["b"],
              },
              { type: "null" },
            ],
          },
        },
        required: ["b"],
      };

      const object1 = v.pipe(
        v.object({ a: v.string() }),
        v.metadata({ ref: "a" })
      );
      const object2 = v.object({ ...object1.entries, b: v.string() });
      const schema = v.nullable(v.object({ b: v.nullable(object2) }));

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("creates a nullable enum", () => {
      const expected: Schema = {
        type: ["string", "null"],
        enum: ["a"],
      };

      const schema = v.nullable(v.picklist(["a"]));

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });
  });
});

describe("Create readonly schema", () => {
  it("creates a simple string schema for a readonly string", () => {
    const expected: Schema = {
      type: "string",
    };

    const schema = v.pipe(v.string(), v.readonly());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});

describe("Create unknown schema", () => {
  it("should create an empty schema for unknown", () => {
    const expected: Schema = {};

    const schema = v.unknown();

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("should create an empty schema for any", () => {
    const expected: Schema = {};

    const schema = v.any();

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
