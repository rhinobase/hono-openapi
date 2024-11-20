import type { Schema3_1 } from "./types";
import { createSchema } from "../index";
import * as v from "valibot";

const valibotArray = v.array(v.string());
const expectedValibotArray: Schema3_1 = {
  type: "array",
  items: {
    type: "string",
  },
};

const valibotBoolean = v.boolean();
const expectedValibotBoolean: Schema3_1 = {
  type: "boolean",
};

const valibotDate = v.date();
const expectedValibotDate: Schema3_1 = {
  type: "string",
};

const valibotDefault = v.optional(v.string(), "a");
const expectedValibotDefault: Schema3_1 = {
  type: "string",
  default: "a",
};

const valibotDiscriminatedUnion = v.variant("type", [
  v.object({
    type: v.literal("a"),
  }),
  v.object({
    type: v.literal("b"),
  }),
]);
const expectedValibotDiscriminatedUnion: Schema3_1 = {
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

const valibotEnum = v.picklist(["a", "b"]);
const expectedValibotEnum: Schema3_1 = {
  type: "string",
  enum: ["a", "b"],
};

const valibotIntersection = v.intersect([v.string(), v.number()]);
const expectedValibotIntersection: Schema3_1 = {
  allOf: [
    {
      type: "string",
    },
    {
      type: "number",
    },
  ],
};

const valibotLiteral = v.literal("a");
const expectedValibotLiteral: Schema3_1 = {
  type: "string",
  const: "a",
};

const valibotMetadata = v.pipe(v.string(), v.metadata({ ref: "a" }));
const expectedValibotMetadata: Schema3_1 = {
  $ref: "#/components/schemas/a",
};

enum Direction {
  Up = "Up",
  Down = "Down",
  Left = "Left",
  Right = "Right",
}
const valibotNativeEnum = v.enum(Direction);
const expectedValibotNativeEnum: Schema3_1 = {
  type: "string",
  enum: ["Up", "Down", "Left", "Right"],
};

const valibotNull = v.null();
const expectedValibotNull: Schema3_1 = {
  type: "null",
};

const valibotNullable = v.nullable(v.string());
const expectedValibotNullable: Schema3_1 = {
  type: ["string", "null"],
};

const valibotNumber = v.number();
const expectedValibotNumber: Schema3_1 = {
  type: "number",
};

const valibotObject = v.object({
  a: v.string(),
  b: v.optional(v.string()),
  c: v.optional(v.string(), "test-default"),
});
const expectedValibotObjectInput: Schema3_1 = {
  type: "object",
  properties: {
    a: { type: "string" },
    b: { type: "string" },
    c: { type: "string", default: "test-default" },
  },
  required: ["a"],
};
const expectedValibotObjectOutput: Schema3_1 = {
  type: "object",
  properties: {
    a: { type: "string" },
    b: { type: "string" },
    c: { type: "string", default: "test-default" },
  },
  required: ["a", "c"],
};

const valibotOptional = v.optional(v.string());
const expectedValibotOptional: Schema3_1 = {
  type: "string",
};

const valibotRecord = v.record(v.string(), v.string());
const expectedValibotRecord: Schema3_1 = {
  type: "object",
  additionalProperties: {
    type: "string",
  },
};

const valibotString = v.string();
const expectedValibotString: Schema3_1 = {
  type: "string",
};

const valibotTuple = v.tuple([v.string(), v.number()]);
const expectedValibotTuple: Schema3_1 = {
  type: "array",
  prefixItems: [
    {
      type: "string",
    },
    {
      type: "number",
    },
  ],
  minItems: 2,
  maxItems: 2,
};

const valibotUnion = v.union([v.string(), v.number()]);
const expectedValibotUnion: Schema3_1 = {
  anyOf: [
    {
      type: "string",
    },
    {
      type: "number",
    },
  ],
};

const valibotCatch = v.fallback(v.string(), "bob");
const expectedValibotCatch: Schema3_1 = {
  type: "string",
  default: "bob",
};

const valibotPipeline = v.pipe(
  v.string(),
  v.transform((arg) => arg.length)
);
const expectedValibotPipelineOutput: Schema3_1 = {
  type: "number",
};
const expectedValibotPipelineInput: Schema3_1 = {
  type: "string",
};

const valibotTransform = v.pipe(
  v.string(),
  v.transform((str) => str.length)
);
const expectedValibotTransform: Schema3_1 = {
  type: "string",
};

const valibotRefine = v.pipe(
  v.string(),
  v.check((arg) => typeof arg === "string")
);
const expectedValibotRefine: Schema3_1 = {
  type: "string",
};

const valibotUnknown = v.unknown();
const expectedManualType: Schema3_1 = {};

const valibotOverride = v.pipe(v.string(), v.metadata({ type: "number" }));
const expectedValibotOverride: Schema3_1 = {
  type: "number",
};

const valibotLazy = v.pipe(
  v.nullable(v.lazy(() => valibotLazy.array())),
  v.metadata({ ref: "lazy" })
);
const expectedValibotLazy: Schema3_1 = {
  $ref: "#/components/schemas/lazy",
};

const BasePost = v.object({
  id: v.string(),
  userId: v.string(),
});

const BaseUser = v.object({
  id: v.string(),
});

const PostSchema = v.pipe(
  v.object({
    ...BasePost.entries,
    user: v.optional(v.lazy(() => valibotLazyComplex)),
  }),
  v.metadata({ ref: "post" })
);

const valibotLazyComplex = v.pipe(
  v.object({
    ...BaseUser.entries,
    posts: v.optional(v.array(v.lazy(() => PostSchema))),
  }),
  v.metadata({ ref: "user" })
);

const expectedValibotLazyComplex: Schema3_1 = {
  $ref: "#/components/schemas/user",
};

const valibotBranded = v.pipe(v.object({ name: v.string() }), v.brand("Cat"));
const expectedValibotBranded: Schema3_1 = {
  type: "object",
  properties: {
    name: {
      type: "string",
    },
  },
  required: ["name"],
};

const valibotSet = v.set(v.string());
const expectedValibotSet: Schema3_1 = {
  type: "array",
  items: {
    type: "string",
  },
  uniqueItems: true,
};

const valibotReadonly = v.pipe(v.string(), v.readonly());
const expectedValibotReadonly: Schema3_1 = {
  type: "string",
};

const valibotBigInt = v.bigint();
const expectedValibotBigInt: Schema3_1 = {
  type: "integer",
  format: "int64",
};

it("creates an output schema for valibotType", () => {
  expect(createSchema(valibotLazyComplex)).toStrictEqual(
    expectedValibotLazyComplex
  );
});

describe("createSchema", () => {
  it.each`
    valibotType                    | schema                       | expected
    ${"ValibotArray"}              | ${valibotArray}              | ${expectedValibotArray}
    ${"ValibotBoolean"}            | ${valibotBoolean}            | ${expectedValibotBoolean}
    ${"ValibotDate"}               | ${valibotDate}               | ${expectedValibotDate}
    ${"ValibotDefault"}            | ${valibotDefault}            | ${expectedValibotDefault}
    ${"ValibotDiscriminatedUnion"} | ${valibotDiscriminatedUnion} | ${expectedValibotDiscriminatedUnion}
    ${"ValibotEnum"}               | ${valibotEnum}               | ${expectedValibotEnum}
    ${"ValibotIntersection"}       | ${valibotIntersection}       | ${expectedValibotIntersection}
    ${"ValibotLiteral"}            | ${valibotLiteral}            | ${expectedValibotLiteral}
    ${"ValibotMetadata"}           | ${valibotMetadata}           | ${expectedValibotMetadata}
    ${"ValibotNativeEnum"}         | ${valibotNativeEnum}         | ${expectedValibotNativeEnum}
    ${"ValibotNull"}               | ${valibotNull}               | ${expectedValibotNull}
    ${"ValibotNullable"}           | ${valibotNullable}           | ${expectedValibotNullable}
    ${"ValibotNumber"}             | ${valibotNumber}             | ${expectedValibotNumber}
    ${"ValibotObject"}             | ${valibotObject}             | ${expectedValibotObjectOutput}
    ${"ValibotOptional"}           | ${valibotOptional}           | ${expectedValibotOptional}
    ${"ValibotRecord"}             | ${valibotRecord}             | ${expectedValibotRecord}
    ${"ValibotString"}             | ${valibotString}             | ${expectedValibotString}
    ${"ValibotTuple"}              | ${valibotTuple}              | ${expectedValibotTuple}
    ${"ValibotUnion"}              | ${valibotUnion}              | ${expectedValibotUnion}
    ${"ValibotCatch"}              | ${valibotCatch}              | ${expectedValibotCatch}
    ${"ValibotPipeline"}           | ${valibotPipeline}           | ${expectedValibotPipelineOutput}
    ${"ValibotEffects - Refine"}   | ${valibotRefine}             | ${expectedValibotRefine}
    ${"manual type"}               | ${valibotUnknown}            | ${expectedManualType}
    ${"override"}                  | ${valibotOverride}           | ${expectedValibotOverride}
    ${"ValibotLazy"}               | ${valibotLazy}               | ${expectedValibotLazy}
    ${"ValibotLazy - Complex"}     | ${valibotLazyComplex}        | ${expectedValibotLazyComplex}
    ${"ValibotBranded"}            | ${valibotBranded}            | ${expectedValibotBranded}
    ${"ValibotSet"}                | ${valibotSet}                | ${expectedValibotSet}
    ${"ValibotReadonly"}           | ${valibotReadonly}           | ${expectedValibotReadonly}
    ${"ValibotBigInt"}             | ${valibotBigInt}             | ${expectedValibotBigInt}
  `("creates an output schema for $valibotType", ({ schema, expected }) => {
    expect(createSchema(schema)).toStrictEqual(expected);
  });

  it.each`
    valibotType                     | schema                       | expected
    ${"ValibotArray"}               | ${valibotArray}              | ${expectedValibotArray}
    ${"ValibotBoolean"}             | ${valibotBoolean}            | ${expectedValibotBoolean}
    ${"ValibotDate"}                | ${valibotDate}               | ${expectedValibotDate}
    ${"ValibotDefault"}             | ${valibotDefault}            | ${expectedValibotDefault}
    ${"ValibotDiscriminatedUnion"}  | ${valibotDiscriminatedUnion} | ${expectedValibotDiscriminatedUnion}
    ${"ValibotEnum"}                | ${valibotEnum}               | ${expectedValibotEnum}
    ${"ValibotIntersection"}        | ${valibotIntersection}       | ${expectedValibotIntersection}
    ${"ValibotLiteral"}             | ${valibotLiteral}            | ${expectedValibotLiteral}
    ${"ValibotMetadata"}            | ${valibotMetadata}           | ${expectedValibotMetadata}
    ${"ValibotNativeEnum"}          | ${valibotNativeEnum}         | ${expectedValibotNativeEnum}
    ${"ValibotNull"}                | ${valibotNull}               | ${expectedValibotNull}
    ${"ValibotNullable"}            | ${valibotNullable}           | ${expectedValibotNullable}
    ${"ValibotNumber"}              | ${valibotNumber}             | ${expectedValibotNumber}
    ${"ValibotObject"}              | ${valibotObject}             | ${expectedValibotObjectInput}
    ${"ValibotOptional"}            | ${valibotOptional}           | ${expectedValibotOptional}
    ${"ValibotRecord"}              | ${valibotRecord}             | ${expectedValibotRecord}
    ${"ValibotString"}              | ${valibotString}             | ${expectedValibotString}
    ${"ValibotTuple"}               | ${valibotTuple}              | ${expectedValibotTuple}
    ${"ValibotUnion"}               | ${valibotUnion}              | ${expectedValibotUnion}
    ${"ValibotCatch"}               | ${valibotCatch}              | ${expectedValibotCatch}
    ${"ValibotPipeline"}            | ${valibotPipeline}           | ${expectedValibotPipelineInput}
    ${"ValibotEffects - Transform"} | ${valibotTransform}          | ${expectedValibotTransform}
    ${"ValibotEffects - Refine"}    | ${valibotRefine}             | ${expectedValibotRefine}
    ${"unknown"}                    | ${valibotUnknown}            | ${expectedManualType}
    ${"ValibotLazy"}                | ${valibotLazy}               | ${expectedValibotLazy}
    ${"ValibotLazy - Complex"}      | ${valibotLazyComplex}        | ${expectedValibotLazyComplex}
    ${"ValibotBranded"}             | ${valibotBranded}            | ${expectedValibotBranded}
    ${"ValibotSet"}                 | ${valibotSet}                | ${expectedValibotSet}
    ${"ValibotReadonly"}            | ${valibotReadonly}           | ${expectedValibotReadonly}
    ${"ValibotBigInt"}              | ${valibotBigInt}             | ${expectedValibotBigInt}
  `("creates an input schema for $valibotType", ({ schema, expected }) => {
    expect(createSchema(schema)).toStrictEqual(expected);
  });

  it("throws an error when an ValibotEffect input component is referenced in an output", () => {
    const inputSchema = v.pipe(
      v.object({
        a: v.pipe(
          v.string(),
          v.transform((arg) => arg.length)
        ),
      }),
      v.metadata({ ref: "a" })
    );
    createSchema(inputSchema);

    const outputSchema = v.object({ b: inputSchema });
    expect(() => createSchema(outputSchema))
      .toThrowErrorMatchingInlineSnapshot(`
"The ValibotObject at previous > property: b is used within a registered compoment schema (a) and contains an input transformation (ValibotEffects - transform) defined at previous > property: a which is also used in an output schema.

This may cause the schema to render incorrectly and is most likely a mistake. You can resolve this by:

1. Setting an \`effectType\` on one of the transformations to \`same\` (Not applicable for ValibotDefault), \`input\` or \`output\` eg. \`.openapi({type: 'same'})\`
2. Wrapping the transformation in a ValibotPipeline
3. Assigning a manual type to the transformation eg. \`.openapi({type: 'string'})\`
4. Removing the transformation
5. Deregister the component containing the transformation"
`);
  });

  it("throws an error when a registered transform is generated with different types", () => {
    const inputSchema = v.pipe(
      v.string(),
      v.transform((arg) => arg.length),
      v.metadata({ ref: "input" })
    );

    createSchema(inputSchema);

    const outputSchema = v.object({
      a: inputSchema,
      b: v.string(),
    });

    expect(() => createSchema(outputSchema))
      .toThrowErrorMatchingInlineSnapshot(`
"The ValibotEffects - transform at previous > path > property: a is used within a registered compoment schema (input) and contains an input transformation (ValibotEffects - transform) defined at previous > other path which is also used in an output schema.

This may cause the schema to render incorrectly and is most likely a mistake. You can resolve this by:

1. Setting an \`effectType\` on one of the transformations to \`same\` (Not applicable for ValibotDefault), \`input\` or \`output\` eg. \`.openapi({type: 'same'})\`
2. Wrapping the transformation in a ValibotPipeline
3. Assigning a manual type to the transformation eg. \`.openapi({type: 'string'})\`
4. Removing the transformation
5. Deregister the component containing the transformation"
`);
  });

  it("does not throw an error when a transform is generated with different types", () => {
    const inputSchema = v.pipe(
      v.string(),
      v.transform((arg) => arg.length),
      v.metadata({ effectType: "input" })
    );

    createSchema(inputSchema);

    const outputSchema = v.object({
      a: inputSchema,
      b: v.string(),
    });

    const result = createSchema(outputSchema);
    expect(result).toEqual({
      properties: {
        a: {
          type: "string",
        },
        b: {
          type: "string",
        },
      },
      required: ["a", "b"],
      type: "object",
    });
  });

  it("does not throw an error when a pipe is generated with different types", () => {
    const inputSchema = v.pipe(v.string(), v.pipe(v.number()));

    const result1 = createSchema(inputSchema);

    const expectedResult1: Schema3_1 = {
      type: "string",
    };
    expect(result1).toStrictEqual(expectedResult1);

    const outputSchema = v.object({
      a: inputSchema,
      b: v.string(),
    });

    const expectedResult2: Schema3_1 = {
      type: "object",
      properties: {
        a: {
          type: "number",
        },
        b: {
          type: "string",
        },
      },
      required: ["a", "b"],
    };
    const result2 = createSchema(outputSchema);
    expect(result2).toStrictEqual(expectedResult2);
  });

  it("throws an error when a pipe is generated with different types", () => {
    const inputSchema = v.pipe(
      v.string(),
      v.pipe(v.number()),
      v.metadata({ ref: "input" })
    );

    createSchema(inputSchema);

    const outputSchema = v.object({
      a: inputSchema,
      b: v.string(),
    });

    expect(() => createSchema(outputSchema))
      .toThrowErrorMatchingInlineSnapshot(`
"The ValibotPipeline at previous > path > property: a is used within a registered compoment schema (input) and contains an input transformation (ValibotPipeline) defined at previous > other path which is also used in an output schema.

This may cause the schema to render incorrectly and is most likely a mistake. You can resolve this by:

1. Setting an \`effectType\` on one of the transformations to \`same\` (Not applicable for ValibotDefault), \`input\` or \`output\` eg. \`.openapi({type: 'same'})\`
2. Wrapping the transformation in a ValibotPipeline
3. Assigning a manual type to the transformation eg. \`.openapi({type: 'string'})\`
4. Removing the transformation
5. Deregister the component containing the transformation"
`);
  });

  it("throws an error when a lazy schema which contains an effect is used in both an input and output", () => {
    const UserIdSchema = v.string();

    const PostSchema2 = v.pipe(
      v.object({
        id: v.string(),
        userId: UserIdSchema,
        user: v.pipe(
          v.nullable(v.lazy(() => PostSchema2)),
          v.metadata({ ref: "user" })
        ),
      }),
      v.metadata({ ref: "post" })
    );

    const ContainerSchema = v.object({
      post: PostSchema2,
    });

    createSchema(ContainerSchema);

    expect(() => createSchema(ContainerSchema))
      .toThrowErrorMatchingInlineSnapshot(`
"The ValibotObject at previous > property: post is used within a registered compoment schema (post) and contains an output transformation (ValibotPipeline) defined at previous > property: post > property: userId which is also used in an input schema.

This may cause the schema to render incorrectly and is most likely a mistake. You can resolve this by:

1. Setting an \`effectType\` on one of the transformations to \`same\` (Not applicable for ValibotDefault), \`input\` or \`output\` eg. \`.openapi({type: 'same'})\`
2. Wrapping the transformation in a ValibotPipeline
3. Assigning a manual type to the transformation eg. \`.openapi({type: 'string'})\`
4. Removing the transformation
5. Deregister the component containing the transformation"
`);
  });
});
