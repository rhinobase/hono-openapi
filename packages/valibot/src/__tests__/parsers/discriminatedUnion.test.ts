import type { Schema, Schema3_1 } from "../types";
import { createSchema } from "../../index";
import * as v from "valibot";

describe("createDiscriminatedUnionSchema", () => {
  it("creates a oneOf schema", () => {
    const expected: Schema3_1 = {
      oneOf: [
        {
          type: "object",
          properties: {
            type: {
              type: "string",
              const: "a",
            },
          },
          required: ["type"],
        },
        {
          type: "object",
          properties: {
            type: {
              type: "string",
              const: "b",
            },
          },
          required: ["type"],
        },
      ],
    };

    const schema = v.variant("type", [
      v.object({
        type: v.literal("a"),
      }),
      v.object({
        type: v.literal("b"),
      }),
    ]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a oneOf schema with discriminator mapping when schemas are registered", () => {
    const expected: Schema = {
      oneOf: [
        {
          $ref: "#/components/schemas/a",
        },
        {
          $ref: "#/components/schemas/b",
        },
      ],
      discriminator: {
        propertyName: "type",
        mapping: {
          a: "#/components/schemas/a",
          b: "#/components/schemas/b",
        },
      },
    };

    const schema = v.variant("type", [
      v.pipe(
        v.object({
          type: v.literal("a"),
        }),
        v.metadata({ ref: "a" })
      ),
      v.pipe(
        v.object({
          type: v.literal("b"),
        }),
        v.metadata({ ref: "b" })
      ),
    ]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a oneOf schema with discriminator mapping when schemas with enums are registered", () => {
    const expected: Schema = {
      oneOf: [
        {
          $ref: "#/components/schemas/c",
        },
        {
          $ref: "#/components/schemas/d",
        },
      ],
      discriminator: {
        propertyName: "type",
        mapping: {
          c: "#/components/schemas/c",
          d: "#/components/schemas/d",
          e: "#/components/schemas/d",
        },
      },
    };

    const schema = v.variant("type", [
      v.pipe(
        v.object({
          type: v.literal("c"),
        }),
        v.metadata({ ref: "c" })
      ),
      v.pipe(
        v.object({
          type: v.picklist(["d", "e"]),
        }),
        v.metadata({ ref: "d" })
      ),
    ]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a oneOf schema with discriminator mapping when schemas with enums are registered manually", () => {
    const expected: Schema = {
      oneOf: [
        {
          $ref: "#/components/schemas/c",
        },
        {
          $ref: "#/components/schemas/d",
        },
      ],
      discriminator: {
        propertyName: "type",
        mapping: {
          c: "#/components/schemas/c",
          d: "#/components/schemas/d",
          e: "#/components/schemas/d",
        },
      },
    };

    const schema = v.variant("type", [
      v.object({
        type: v.literal("c"),
      }),
      v.object({
        type: v.picklist(["d", "e"]),
      }),
    ]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a oneOf schema with discriminator mapping when schemas with string nativeEnums", () => {
    const expected: Schema = {
      discriminator: {
        mapping: {
          a: "#/components/schemas/a",
          c: "#/components/schemas/a",
          b: "#/components/schemas/b",
        },
        propertyName: "type",
      },
      oneOf: [
        {
          $ref: "#/components/schemas/a",
        },
        {
          $ref: "#/components/schemas/b",
        },
      ],
    };

    enum letters {
      a = "a",
      c = "c",
    }

    const schema = v.variant("type", [
      v.pipe(
        v.object({
          type: v.enum(letters),
        }),
        v.metadata({ ref: "a" })
      ),
      v.pipe(
        v.object({
          type: v.literal("b"),
        }),
        v.metadata({ ref: "b" })
      ),
    ]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates a oneOf schema without discriminator mapping when schemas with mixed nativeEnums", () => {
    const expected: Schema = {
      oneOf: [
        {
          $ref: "#/components/schemas/a",
        },
        {
          $ref: "#/components/schemas/b",
        },
      ],
    };

    enum mixed {
      a = "a",
      c = "c",
      d = 1,
    }

    const schema = v.variant("type", [
      v.pipe(
        v.object({
          type: v.enum(mixed),
        }),
        v.metadata({ ref: "a" })
      ),
      v.pipe(
        v.object({
          type: v.literal("b"),
        }),
        v.metadata({ ref: "b" })
      ),
    ]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("handles a discriminated union with a nullable type", () => {
    const expected: Schema = {
      oneOf: [
        {
          $ref: "#/components/schemas/a",
        },
        {
          $ref: "#/components/schemas/b",
        },
      ],
    };

    const schema = v.variant("type", [
      v.pipe(
        v.object({
          type: v.nullable(v.literal("a")),
        }),
        v.metadata({ ref: "a" })
      ),
      v.pipe(
        v.object({
          type: v.literal("b"),
        }),
        v.metadata({ ref: "b" })
      ),
    ]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("handles a discriminated union with a branded type", () => {
    const expected: Schema = {
      discriminator: {
        mapping: {
          a: "#/components/schemas/a",
          b: "#/components/schemas/b",
        },
        propertyName: "type",
      },
      oneOf: [
        {
          $ref: "#/components/schemas/a",
        },
        {
          $ref: "#/components/schemas/b",
        },
      ],
    };

    const schema = v.variant("type", [
      v.pipe(
        v.object({
          type: v.pipe(v.literal("a"), v.brand("_")),
        }),
        v.metadata({ ref: "a" })
      ),
      v.pipe(
        v.object({
          type: v.literal("b"),
        }),
        v.metadata({ ref: "b" })
      ),
    ]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("handles a discriminated union with a branded enum type", () => {
    const expected: Schema = {
      discriminator: {
        mapping: {
          a: "#/components/schemas/a",
          c: "#/components/schemas/a",
          b: "#/components/schemas/b",
        },
        propertyName: "type",
      },
      oneOf: [
        {
          $ref: "#/components/schemas/a",
        },
        {
          $ref: "#/components/schemas/b",
        },
      ],
    };

    const schema = v.variant("type", [
      v.pipe(
        v.object({
          type: v.pipe(v.picklist(["a", "c"]), v.brand("_")),
        }),
        v.metadata({ ref: "a" })
      ),
      v.pipe(
        v.object({
          type: v.literal("b"),
        }),
        v.metadata({ ref: "b" })
      ),
    ]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("handles a discriminated union with a readonly type", () => {
    const expected: Schema = {
      discriminator: {
        mapping: {
          a: "#/components/schemas/a",
          b: "#/components/schemas/b",
        },
        propertyName: "type",
      },
      oneOf: [
        {
          $ref: "#/components/schemas/a",
        },
        {
          $ref: "#/components/schemas/b",
        },
      ],
    };

    const schema = v.variant("type", [
      v.pipe(
        v.object({
          type: v.pipe(v.literal("a"), v.readonly()),
        }),
        v.metadata({ ref: "a" })
      ),
      v.pipe(
        v.object({
          type: v.literal("b"),
        }),
        v.metadata({ ref: "b" })
      ),
    ]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("handles a discriminated union with a catch type", () => {
    const expected: Schema = {
      discriminator: {
        mapping: {
          a: "#/components/schemas/a",
          b: "#/components/schemas/b",
        },
        propertyName: "type",
      },
      oneOf: [
        {
          $ref: "#/components/schemas/a",
        },
        {
          $ref: "#/components/schemas/b",
        },
      ],
    };

    const schema = v.variant("type", [
      v.pipe(
        v.object({
          type: v.fallback(v.literal("a"), "a"),
        }),
        v.metadata({ ref: "a" })
      ),
      v.pipe(
        v.object({
          type: v.literal("b"),
        }),
        v.metadata({ ref: "b" })
      ),
    ]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
