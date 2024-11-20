import type { Schema3_1 } from "./types";
import { createSchema } from "../index";
import * as v from "valibot";

describe("enhanceWithMetadata", () => {
  it("adds .openapi metadata", () => {
    const expected: Schema3_1 = {
      type: "schema",
      schema: {
        type: "string",
        description: "bla",
      },
    };
    const schema = v.pipe(v.string(), v.metadata({ description: "bla" }));

    const result = createSchema(schema);

    expect(result).toStrictEqual(expected);
  });

  it("adds .describe metadata", () => {
    const expected: Schema3_1 = {
      type: "schema",
      schema: {
        type: "string",
        description: "bla",
      },
    };
    const schema = v.pipe(v.string(), v.description("bla"));

    const result = createSchema(schema);

    expect(result).toStrictEqual(expected);
  });

  it("overrides .describe metadata with .openapi metadata", () => {
    const expected: Schema3_1 = {
      type: "schema",
      schema: {
        type: "string",
        description: "foo",
      },
    };

    const schema = v.pipe(
      v.string(),
      v.description("bla"),
      v.metadata({ description: "foo" })
    );

    const result = createSchema(schema);

    expect(result).toStrictEqual(expected);
  });

  it("does not add additional descriptions with .describe() to registered schemas", () => {
    const blaSchema = v.pipe(
      v.string(),
      v.description("bla"),
      v.metadata({ ref: "bla" })
    );
    const fooSchema = v.optional(blaSchema);

    const expected: Schema3_1 = {
      type: "ref",
      schema: {
        $ref: "#/components/schemas/bla",
      },
      zodType: blaSchema,
      schemaObject: {
        type: "string",
        description: "bla",
      },
    };

    const result = createSchema(fooSchema);

    expect(result).toStrictEqual(expected);
  });

  it("overrides type with .openapi type metadata", () => {
    const expected: Schema3_1 = {
      type: "schema",
      schema: {
        type: "integer",
      },
    };
    const schema = v.pipe(v.string(), v.metadata({ type: "integer" }));

    const result = createSchema(schema);

    expect(result).toStrictEqual(expected);
  });

  it("adds adds a description alongside $ref when only description is added in 3.1.0", () => {
    const ref = v.pipe(v.string(), v.metadata({ ref: "ref" }));

    const expected: Schema3_1 = {
      type: "ref",
      schema: {
        $ref: "#/components/schemas/ref",
        description: "hello",
      },
      zodType: ref,
      schemaObject: {
        type: "string",
      },
    };

    const schema = v.pipe(
      v.optional(ref),
      v.metadata({ description: "hello" })
    );

    const result = createSchema(schema);

    expect(result).toStrictEqual(expected);
  });

  it("adds adds a description alongside allOf when only description is added in 3.0.0", () => {
    const ref = v.pipe(v.string(), v.metadata({ ref: "ref" }));

    const expected: Schema3_1 = {
      type: "schema",
      schema: {
        allOf: [
          {
            $ref: "#/components/schemas/ref",
          },
        ],
        description: "hello",
      },
    };

    const schema = v.pipe(
      v.optional(ref),
      v.metadata({ description: "hello" })
    );

    const result = createSchema(schema);

    expect(result).toStrictEqual(expected);
  });

  it("adds allOf to $refs only if there is new metadata", () => {
    const ref = v.pipe(v.string(), v.metadata({ ref: "og" }));
    const expected: Schema3_1 = {
      type: "ref",
      schema: {
        $ref: "#/components/schemas/og",
      },
      zodType: ref,
      schemaObject: {
        type: "string",
      },
    };

    const schema = v.optional(ref);

    const result = createSchema(schema);

    expect(result).toStrictEqual(expected);
  });

  it("adds to a registered schema", () => {
    const expected: Schema3_1 = {
      type: "schema",
      schema: {
        allOf: [
          {
            $ref: "#/components/schemas/ref2",
          },
        ],
        default: "a",
      },
    };

    const ref = v.pipe(v.string(), v.metadata({ ref: "ref2" }));
    const schema = v.optional(ref, "a");

    const result = createSchema(schema);

    expect(result).toStrictEqual(expected);
  });

  it("adds to the last element of an allOf schema", () => {
    const expected: Schema3_1 = {
      type: "schema",
      schema: {
        type: "object",
        properties: {
          b: {
            allOf: [{ $ref: "#/components/schemas/a" }],
            properties: { b: { type: "string" } },
            required: ["b"],
            description: "jello",
          },
        },
        required: ["b"],
      },
    };
    const object1 = v.pipe(
      v.object({ a: v.string() }),
      v.metadata({ ref: "a" })
    );
    const object2 = v.object({ ...object1.entries, b: v.string() });
    const schema = v.object({
      b: v.pipe(object2, v.metadata({ description: "jello" })),
    });

    const result = createSchema(schema);

    expect(result).toStrictEqual(expected);
  });

  it("handles current and previous schemas", () => {
    const FooSchema = v.pipe(v.string(), v.metadata({ ref: "foo" }));
    const CazSchema = v.pipe(
      v.object({ a: v.string() }),
      v.metadata({ ref: "caz" })
    );
    const QuxSchema = v.pipe(
      v.object({ ...CazSchema.entries, b: FooSchema }),
      v.metadata({
        ref: "qux",
      })
    );

    const BarSchema = v.object({
      a: v.optional(FooSchema),
      b: v.optional(v.pipe(FooSchema, v.metadata({ description: "bar" }))),
      c: v.pipe(FooSchema, v.minWords("en", 1), v.maxWords("en", 10)),
      d: v.pipe(
        FooSchema,
        v.metadata({ description: "bar" }),
        v.minWords("en", 1),
        v.maxWords("en", 10)
      ),
      e: v.fallback(FooSchema, "a"),
      f: v.optional(FooSchema, "a"),
      g: v.pipe(FooSchema, v.email()),
      h: v.pipe(FooSchema, v.isoDateTime()),
      i: v.pipe(
        FooSchema,
        v.metadata({ example: "foo" }),
        v.minWords("en", 1),
        v.maxWords("en", 10)
      ),
      j: v.pipe(v.optional(FooSchema), v.metadata({ description: "bar" })),
      k: v.pipe(v.nullish(FooSchema), v.metadata({ description: "bar" })),
      l: v.pipe(FooSchema, v.description("bar")),
      m: v.pipe(CazSchema, v.metadata({ description: "bar" })),
      n: QuxSchema,
      o: v.pipe(
        v.object({ ...QuxSchema.entries, c: FooSchema }),
        v.metadata({ description: "qux" })
      ),
    });

    const result = createSchema(BarSchema);
    const inputResult = createSchema(BarSchema);

    expect(result).toMatchInlineSnapshot(`
{
  "effects": [
    {
      "creationType": "output",
      "path": [
        "property: e",
      ],
      "type": "schema",
      "zodType": ZodCatch {
        "_def": {
          "catchValue": [Function],
          "description": undefined,
          "errorMap": [Function],
          "innerType": ZodString {
            "_def": {
              "checks": [],
              "coerce": false,
              "typeName": "ZodString",
              "zodOpenApi": {
                "current": [Circular],
                "openapi": {
                  "ref": "foo",
                },
              },
            },
            "and": [Function],
            "array": [Function],
            "brand": [Function],
            "catch": [Function],
            "default": [Function],
            "describe": [Function],
            "isNullable": [Function],
            "isOptional": [Function],
            "nullable": [Function],
            "nullish": [Function],
            "optional": [Function],
            "or": [Function],
            "parse": [Function],
            "parseAsync": [Function],
            "pipe": [Function],
            "promise": [Function],
            "readonly": [Function],
            "refine": [Function],
            "refinement": [Function],
            "safeParse": [Function],
            "safeParseAsync": [Function],
            "spa": [Function],
            "superRefine": [Function],
            "transform": [Function],
          },
          "typeName": "ZodCatch",
        },
        "and": [Function],
        "array": [Function],
        "brand": [Function],
        "catch": [Function],
        "default": [Function],
        "describe": [Function],
        "isNullable": [Function],
        "isOptional": [Function],
        "nullable": [Function],
        "nullish": [Function],
        "optional": [Function],
        "or": [Function],
        "parse": [Function],
        "parseAsync": [Function],
        "pipe": [Function],
        "promise": [Function],
        "readonly": [Function],
        "refine": [Function],
        "refinement": [Function],
        "safeParse": [Function],
        "safeParseAsync": [Function],
        "spa": [Function],
        "superRefine": [Function],
        "transform": [Function],
      },
    },
    {
      "creationType": "output",
      "path": [
        "property: f",
      ],
      "type": "schema",
      "zodType": ZodDefault {
        "_def": {
          "defaultValue": [Function],
          "description": undefined,
          "errorMap": [Function],
          "innerType": ZodString {
            "_def": {
              "checks": [],
              "coerce": false,
              "typeName": "ZodString",
              "zodOpenApi": {
                "current": [Circular],
                "openapi": {
                  "ref": "foo",
                },
              },
            },
            "and": [Function],
            "array": [Function],
            "brand": [Function],
            "catch": [Function],
            "default": [Function],
            "describe": [Function],
            "isNullable": [Function],
            "isOptional": [Function],
            "nullable": [Function],
            "nullish": [Function],
            "optional": [Function],
            "or": [Function],
            "parse": [Function],
            "parseAsync": [Function],
            "pipe": [Function],
            "promise": [Function],
            "readonly": [Function],
            "refine": [Function],
            "refinement": [Function],
            "safeParse": [Function],
            "safeParseAsync": [Function],
            "spa": [Function],
            "superRefine": [Function],
            "transform": [Function],
          },
          "typeName": "ZodDefault",
        },
        "and": [Function],
        "array": [Function],
        "brand": [Function],
        "catch": [Function],
        "default": [Function],
        "describe": [Function],
        "isNullable": [Function],
        "isOptional": [Function],
        "nullable": [Function],
        "nullish": [Function],
        "optional": [Function],
        "or": [Function],
        "parse": [Function],
        "parseAsync": [Function],
        "pipe": [Function],
        "promise": [Function],
        "readonly": [Function],
        "refine": [Function],
        "refinement": [Function],
        "safeParse": [Function],
        "safeParseAsync": [Function],
        "spa": [Function],
        "superRefine": [Function],
        "transform": [Function],
      },
    },
  ],
  "schema": {
    "properties": {
      "a": {
        "$ref": "#/components/schemas/foo",
      },
      "b": {
        "$ref": "#/components/schemas/foo",
        "description": "bar",
      },
      "c": {
        "allOf": [
          {
            "$ref": "#/components/schemas/foo",
          },
        ],
        "maxLength": 10,
        "minLength": 1,
      },
      "d": {
        "allOf": [
          {
            "$ref": "#/components/schemas/foo",
          },
        ],
        "description": "bar",
        "maxLength": 10,
        "minLength": 1,
      },
      "e": {
        "allOf": [
          {
            "$ref": "#/components/schemas/foo",
          },
        ],
        "default": "a",
      },
      "f": {
        "allOf": [
          {
            "$ref": "#/components/schemas/foo",
          },
        ],
        "default": "a",
      },
      "g": {
        "allOf": [
          {
            "$ref": "#/components/schemas/foo",
          },
        ],
        "format": "email",
      },
      "h": {
        "allOf": [
          {
            "$ref": "#/components/schemas/foo",
          },
        ],
        "format": "date-time",
      },
      "i": {
        "allOf": [
          {
            "$ref": "#/components/schemas/foo",
          },
        ],
        "example": "foo",
        "maxLength": 10,
        "minLength": 1,
      },
      "j": {
        "$ref": "#/components/schemas/foo",
        "description": "bar",
      },
      "k": {
        "description": "bar",
        "oneOf": [
          {
            "$ref": "#/components/schemas/foo",
          },
          {
            "type": "null",
          },
        ],
      },
      "l": {
        "$ref": "#/components/schemas/foo",
        "description": "bar",
      },
      "m": {
        "$ref": "#/components/schemas/caz",
        "description": "bar",
      },
      "n": {
        "$ref": "#/components/schemas/qux",
      },
      "o": {
        "allOf": [
          {
            "$ref": "#/components/schemas/qux",
          },
        ],
        "description": "qux",
        "properties": {
          "c": {
            "$ref": "#/components/schemas/foo",
          },
        },
        "required": [
          "c",
        ],
      },
    },
    "required": [
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "i",
      "l",
      "m",
      "n",
      "o",
    ],
    "type": "object",
  },
  "type": "schema",
}
`);

    expect(inputResult).toMatchInlineSnapshot(`
{
  "effects": [
    {
      "creationType": "input",
      "path": [
        "property: e",
      ],
      "type": "schema",
      "zodType": ZodCatch {
        "_def": {
          "catchValue": [Function],
          "description": undefined,
          "errorMap": [Function],
          "innerType": ZodString {
            "_def": {
              "checks": [],
              "coerce": false,
              "typeName": "ZodString",
              "zodOpenApi": {
                "current": [Circular],
                "openapi": {
                  "ref": "foo",
                },
              },
            },
            "and": [Function],
            "array": [Function],
            "brand": [Function],
            "catch": [Function],
            "default": [Function],
            "describe": [Function],
            "isNullable": [Function],
            "isOptional": [Function],
            "nullable": [Function],
            "nullish": [Function],
            "optional": [Function],
            "or": [Function],
            "parse": [Function],
            "parseAsync": [Function],
            "pipe": [Function],
            "promise": [Function],
            "readonly": [Function],
            "refine": [Function],
            "refinement": [Function],
            "safeParse": [Function],
            "safeParseAsync": [Function],
            "spa": [Function],
            "superRefine": [Function],
            "transform": [Function],
          },
          "typeName": "ZodCatch",
        },
        "and": [Function],
        "array": [Function],
        "brand": [Function],
        "catch": [Function],
        "default": [Function],
        "describe": [Function],
        "isNullable": [Function],
        "isOptional": [Function],
        "nullable": [Function],
        "nullish": [Function],
        "optional": [Function],
        "or": [Function],
        "parse": [Function],
        "parseAsync": [Function],
        "pipe": [Function],
        "promise": [Function],
        "readonly": [Function],
        "refine": [Function],
        "refinement": [Function],
        "safeParse": [Function],
        "safeParseAsync": [Function],
        "spa": [Function],
        "superRefine": [Function],
        "transform": [Function],
      },
    },
    {
      "creationType": "input",
      "path": [
        "property: f",
      ],
      "type": "schema",
      "zodType": ZodDefault {
        "_def": {
          "defaultValue": [Function],
          "description": undefined,
          "errorMap": [Function],
          "innerType": ZodString {
            "_def": {
              "checks": [],
              "coerce": false,
              "typeName": "ZodString",
              "zodOpenApi": {
                "current": [Circular],
                "openapi": {
                  "ref": "foo",
                },
              },
            },
            "and": [Function],
            "array": [Function],
            "brand": [Function],
            "catch": [Function],
            "default": [Function],
            "describe": [Function],
            "isNullable": [Function],
            "isOptional": [Function],
            "nullable": [Function],
            "nullish": [Function],
            "optional": [Function],
            "or": [Function],
            "parse": [Function],
            "parseAsync": [Function],
            "pipe": [Function],
            "promise": [Function],
            "readonly": [Function],
            "refine": [Function],
            "refinement": [Function],
            "safeParse": [Function],
            "safeParseAsync": [Function],
            "spa": [Function],
            "superRefine": [Function],
            "transform": [Function],
          },
          "typeName": "ZodDefault",
        },
        "and": [Function],
        "array": [Function],
        "brand": [Function],
        "catch": [Function],
        "default": [Function],
        "describe": [Function],
        "isNullable": [Function],
        "isOptional": [Function],
        "nullable": [Function],
        "nullish": [Function],
        "optional": [Function],
        "or": [Function],
        "parse": [Function],
        "parseAsync": [Function],
        "pipe": [Function],
        "promise": [Function],
        "readonly": [Function],
        "refine": [Function],
        "refinement": [Function],
        "safeParse": [Function],
        "safeParseAsync": [Function],
        "spa": [Function],
        "superRefine": [Function],
        "transform": [Function],
      },
    },
  ],
  "schema": {
    "properties": {
      "a": {
        "$ref": "#/components/schemas/foo",
      },
      "b": {
        "$ref": "#/components/schemas/foo",
        "description": "bar",
      },
      "c": {
        "allOf": [
          {
            "$ref": "#/components/schemas/foo",
          },
        ],
        "maxLength": 10,
        "minLength": 1,
      },
      "d": {
        "allOf": [
          {
            "$ref": "#/components/schemas/foo",
          },
        ],
        "description": "bar",
        "maxLength": 10,
        "minLength": 1,
      },
      "e": {
        "allOf": [
          {
            "$ref": "#/components/schemas/foo",
          },
        ],
        "default": "a",
      },
      "f": {
        "allOf": [
          {
            "$ref": "#/components/schemas/foo",
          },
        ],
        "default": "a",
      },
      "g": {
        "allOf": [
          {
            "$ref": "#/components/schemas/foo",
          },
        ],
        "format": "email",
      },
      "h": {
        "allOf": [
          {
            "$ref": "#/components/schemas/foo",
          },
        ],
        "format": "date-time",
      },
      "i": {
        "allOf": [
          {
            "$ref": "#/components/schemas/foo",
          },
        ],
        "example": "foo",
        "maxLength": 10,
        "minLength": 1,
      },
      "j": {
        "$ref": "#/components/schemas/foo",
        "description": "bar",
      },
      "k": {
        "description": "bar",
        "oneOf": [
          {
            "$ref": "#/components/schemas/foo",
          },
          {
            "type": "null",
          },
        ],
      },
      "l": {
        "$ref": "#/components/schemas/foo",
        "description": "bar",
      },
      "m": {
        "$ref": "#/components/schemas/caz",
        "description": "bar",
      },
      "n": {
        "$ref": "#/components/schemas/qux",
      },
      "o": {
        "allOf": [
          {
            "$ref": "#/components/schemas/qux",
          },
        ],
        "description": "qux",
        "properties": {
          "c": {
            "$ref": "#/components/schemas/foo",
          },
        },
        "required": [
          "c",
        ],
      },
    },
    "required": [
      "c",
      "d",
      "g",
      "h",
      "i",
      "l",
      "m",
      "n",
      "o",
    ],
    "type": "object",
  },
  "type": "schema",
}
`);
  });
});
