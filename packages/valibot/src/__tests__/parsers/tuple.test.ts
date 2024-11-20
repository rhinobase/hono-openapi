import * as v from "valibot";
import { createSchema } from "../../index";
import type { Schema, Schema3_1 } from "../types";

describe("Create tuple schema", () => {
  it("creates an array schema", () => {
    const expected: Schema3_1 = {
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
    const schema = v.tuple([v.string(), v.number()]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates an array schema with additionalProperties", () => {
    const expected: Schema = {
      type: "array",

      prefixItems: [
        {
          type: "string",
        },
        {
          type: "number",
        },
      ],
      items: {
        type: "boolean",
      },
    };

    const schema = v.tupleWithRest([v.string(), v.number()], v.boolean());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates an empty array schema", () => {
    const expected: Schema = {
      type: "array",
      minItems: 0,
      maxItems: 0,
    };

    const schema = v.tuple([]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates an array schema with additionalProperties in openapi 3.0.0", () => {
    const expected: Schema = {
      type: "array",
      items: {
        oneOf: [
          {
            type: "string",
          },
          {
            type: "number",
          },
          {
            type: "boolean",
          },
        ],
      },
    };

    const schema = v.tupleWithRest([v.string(), v.number()], v.boolean());

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
