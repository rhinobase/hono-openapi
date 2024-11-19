import type { Schema, Schema3_1 } from "../types";
import { createSchema } from "../../index";
import * as v from "valibot";

describe("createObjectSchema", () => {
  it("creates a simple object with required and optionals", () => {
    const expected: Schema = {
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: "string" },
      },
      required: ["a"],
    };

    const schema = v.object({
      a: v.string(),
      b: v.optional(v.string()),
    });

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a object with strict", () => {
    const expected: Schema = {
      type: "object",
      properties: {
        a: {
          type: "string",
        },
      },
      required: ["a"],
      additionalProperties: false,
    };

    const schema = v.strictObject({
      a: v.string(),
    });

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("supports catchall", () => {
    const expected: Schema = {
      type: "object",
      properties: {
        a: { type: "string" },
      },
      required: ["a"],
      additionalProperties: { type: "boolean" },
    };

    const schema = v.objectWithRest(
      {
        a: v.string(),
      },
      v.boolean()
    );

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("considers ZodDefault in an input state as an effect", () => {
    const schema = v.object({
      a: v.optional(v.string(), "a"),
    });

    const expected: Schema = {
      type: "object",
      properties: {
        a: { type: "string", default: "a" },
      },
    };

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("considers ZodCatch in an input state as an effect", () => {
    const schema = v.object({
      a: v.fallback(v.string(), "a"),
    });

    const expected: Schema = {
      type: "object",
      properties: {
        a: { type: "string", default: "a" },
      },
    };

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("considers ZodDefault in an output state as an effect", () => {
    const schema = v.object({
      a: v.optional(v.string(), "a"),
    });

    const expected: Schema = {
      type: "object",
      properties: {
        a: { type: "string", default: "a" },
      },
      required: ["a"],
    };

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("considers ZodCatch in an output state as an effect", () => {
    const schema = v.object({
      a: v.fallback(v.string(), "a"),
    });

    const expected: Schema = {
      type: "object",
      properties: {
        a: { type: "string", default: "a" },
      },
      required: ["a"],
    };

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});

describe("required", () => {
  describe("output", () => {
    it("creates a required array containing all properties", () => {
      const expected: Schema3_1 = {
        type: "object",
        properties: {
          a: { type: "string" },
          b: { type: ["string", "null"] },
          c: { type: "number" },
          d: { anyOf: [{ type: "string" }, { type: "number" }] },
          e: {},
          f: { type: "string", default: "a" },
          g: { type: "string", default: "a" },
        },
        required: ["a", "b", "c", "d", "e", "f", "g"],
      };

      const schema = v.object({
        a: v.string(),
        b: v.nullable(v.string()),
        c: v.number(),
        d: v.union([v.string(), v.number()]),
        e: v.custom((r) => r !== undefined),
        f: v.optional(v.string(), "a"),
        g: v.fallback(v.string(), "a"),
      });

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("does not create an required array", () => {
      const expected: Schema3_1 = {
        type: "object",
        properties: {
          c: { type: "string" },
          d: { type: ["string", "null"] },
          e: { type: "number" },
          f: { anyOf: [{ type: "string" }] },
          g: { anyOf: [{ type: "string" }, { type: "number" }] },
          h: { $ref: "#/components/schemas/ref" },
          i: { $ref: "#/components/schemas/oref" },
          j: {},
          k: { type: "number" },
        },
      };

      const ref = v.pipe(v.string(), v.metadata({ ref: "ref" }));
      const oref = v.pipe(v.optional(v.string()), v.metadata({ ref: "oref" }));
      const schema = v.object({
        a: v.never(),
        b: v.undefined(),
        c: v.optional(v.string()),
        d: v.nullish(v.string()),
        e: v.optional(v.number()),
        f: v.union([v.string(), v.undefined()]),
        g: v.union([v.string(), v.optional(v.number())]),
        h: v.optional(ref),
        i: oref,
        j: v.optional(v.string()),
        k: v.pipe(
          v.optional(v.string()),
          v.transform((str) => str?.length)
        ),
      });

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });
  });

  describe("input", () => {
    it("creates a required array containing all properties", () => {
      const expected: Schema3_1 = {
        type: "object",
        properties: {
          a: { type: "string" },
          b: { type: ["string", "null"] },
          c: { type: "number" },
          d: { anyOf: [{ type: "string" }, { type: "number" }] },
          e: {},
        },
        required: ["a", "b", "c", "d", "e", "f"],
      };

      const schema = v.object({
        a: v.string(),
        b: v.nullable(v.string()),
        c: v.number(),
        d: v.union([v.string(), v.number()]),
        e: v.custom((r) => r !== undefined),
      });

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });

    it("does not create an required array", () => {
      const expected: Schema3_1 = {
        type: "object",
        properties: {
          c: { type: "string" },
          d: { type: ["string", "null"] },
          e: { type: "number" },
          f: { anyOf: [{ type: "string" }] },
          g: { anyOf: [{ type: "string" }, { type: "number" }] },
          h: { $ref: "#/components/schemas/ref" },
          i: { $ref: "#/components/schemas/oref" },
          j: {},
          k: { type: "string" },
          l: { type: "string", default: "a" },
        },
      };

      const ref = v.pipe(v.string(), v.metadata({ ref: "ref" }));
      const oref = v.pipe(v.optional(v.string()), v.metadata({ ref: "oref" }));
      const schema = v.object({
        a: v.never(),
        b: v.undefined(),
        c: v.optional(v.string()),
        d: v.nullish(v.string()),
        e: v.optional(v.number()),
        f: v.union([v.string(), v.undefined()]),
        g: v.union([v.string(), v.optional(v.number())]),
        h: v.optional(ref),
        i: oref,
        j: v.optional(v.string()),
        k: v.pipe(
          v.optional(v.string()),
          v.transform((str) => str?.length)
        ),
        l: v.optional(v.string(), "a"),
      });

      const result = createSchema(schema);

      expect(result.schema).toStrictEqual(expected);
    });
  });
});

describe("extend", () => {
  it("creates an extended object", () => {
    const expected: Schema = {
      type: "object",
      properties: {
        obj1: { $ref: "#/components/schemas/obj1" },
        obj2: {
          allOf: [{ $ref: "#/components/schemas/obj1" }],
          properties: { b: { type: "string" } },
          required: ["b"],
        },
      },
      required: ["obj1", "obj2"],
    };

    const object1 = v.pipe(
      v.object({ a: v.string() }),
      v.metadata({ ref: "obj1" })
    );
    const object2 = v.union([object1, v.object({ b: v.string() })]);
    const schema = v.object({
      obj1: object1,
      obj2: object2,
    });

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("does not create an allOf schema when the base object has a catchall", () => {
    const expected: Schema = {
      type: "object",
      properties: {
        obj1: { $ref: "#/components/schemas/obj1" },
        obj2: {
          type: "object",
          properties: { a: { type: "string" }, b: { type: "number" } },
          required: ["a", "b"],
          additionalProperties: {
            type: "boolean",
          },
        },
      },
      required: ["obj1", "obj2"],
    };

    const object1 = v.pipe(
      v.objectWithRest({ a: v.string() }, v.boolean()),
      v.metadata({ ref: "obj1" })
    );
    const object2 = v.union([object1, v.object({ b: v.number() })]);
    const schema = v.object({
      obj1: object1,
      obj2: object2,
    });

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates an allOf schema when catchall is on the extended object", () => {
    const expected: Schema = {
      type: "object",
      properties: {
        obj1: { $ref: "#/components/schemas/obj1" },
        obj2: {
          allOf: [{ $ref: "#/components/schemas/obj1" }],
          properties: { b: { type: "number" } },
          required: ["b"],
          additionalProperties: {
            type: "boolean",
          },
        },
      },
      required: ["obj1", "obj2"],
    };

    const object1 = v.pipe(
      v.object({ a: v.string() }),
      v.metadata({ ref: "obj1" })
    );
    const object2 = v.union([
      object1,
      v.objectWithRest({ b: v.number() }, v.boolean()),
    ]);
    const schema = v.object({
      obj1: object1,
      obj2: object2,
    });

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("auto registers the base of an extended object", () => {
    const object1 = v.pipe(
      v.object({ a: v.string() }),
      v.metadata({ ref: "obj1" })
    );
    const object2 = v.union([object1, v.object({ b: v.string() })]);
    const schema = v.object({
      obj1: object1,
      obj2: object2,
    });

    const result = createSchema(schema);

    expect(result.schema.get(object1)?.ref).toBe("obj1");
    expect(result.schema.get(object1)?.ref).toBe("complete");
  });

  it("does not create an allOf schema when the extension overrides a field", () => {
    const expected: Schema = {
      type: "object",
      properties: {
        obj1: { $ref: "#/components/schemas/obj1" },
        obj2: {
          type: "object",
          properties: { a: { type: "number" } },
          required: ["a"],
        },
      },
      required: ["obj1", "obj2"],
    };

    const object1 = v.pipe(
      v.object({ a: v.string() }),
      v.metadata({ ref: "obj1" })
    );
    const object2 = v.union([object1, v.object({ a: v.number() })]);
    const schema = v.object({
      obj1: object1,
      obj2: object2,
    });

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates an object with 2 required fields using a custom type", () => {
    const expected: Schema = {
      type: "object",
      properties: {
        a: {
          type: "string",
        },
        b: {
          type: "string",
          format: "date",
        },
      },
      required: ["a", "b"],
    };

    const zodDate = v.pipe(
      v.union([
        v.custom<Date>((val: unknown) => val instanceof Date),
        v.pipe(
          v.string(),
          v.transform((str: string): Date => new Date(str))
        ), // ignore validation
      ]),
      v.metadata({
        type: "string",
        format: "date",
      })
    );

    const schema = v.object({
      a: v.string(),
      b: zodDate,
    });

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
