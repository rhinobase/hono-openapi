import * as v from "valibot";
import { createSchema } from "valibot-openapi";
import type { Schema, Schema3_1 } from "../types";

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
