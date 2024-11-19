import type { Schema } from "../types";
import { createSchema } from "../../index";
import * as v from "valibot";

describe("createIntersectionSchema", () => {
  it("creates an intersection schema", () => {
    const expected: Schema = {
      allOf: [
        {
          type: "string",
        },
        {
          type: "number",
        },
      ],
    };

    const schema = v.intersect([v.string(), v.number()]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates an object with an allOf", () => {
    const expected: Schema = {
      allOf: [
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
    };

    const schema = v.intersect([
      v.object({
        a: v.string(),
      }),
      v.object({
        b: v.string(),
      }),
    ]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("attempts to flatten nested and usage", () => {
    const expected: Schema = {
      allOf: [
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
          type: "object",
          properties: {
            c: {
              type: "string",
            },
          },
          required: ["c"],
        },
      ],
    };

    const schema = v.intersect([
      v.object({
        a: v.string(),
      }),
      v.object({
        b: v.string(),
      }),
      v.object({
        c: v.string(),
      }),
    ]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
