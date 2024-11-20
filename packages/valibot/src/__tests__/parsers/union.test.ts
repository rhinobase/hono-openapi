import * as v from "valibot";
import { createSchema } from "../../index";
import type { Schema } from "../types";

describe("Create union schema", () => {
  it("creates an anyOf schema for a union", () => {
    const expected: Schema = {
      anyOf: [
        {
          type: "string",
        },
        {
          type: "number",
        },
      ],
    };
    const schema = v.union([v.string(), v.number()]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates an oneOf schema for a union if unionOneOf is true", () => {
    const expected: Schema = {
      oneOf: [
        {
          type: "string",
        },
        {
          type: "number",
        },
      ],
    };
    const schema = v.pipe(
      v.union([v.string(), v.number()]),
      v.metadata({ unionOneOf: true })
    );

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("creates an oneOf schema for a union if the document options unionOneOf is true", () => {
    const expected: Schema = {
      oneOf: [
        {
          type: "string",
        },
        {
          type: "number",
        },
      ],
    };
    const schema = v.union([v.string(), v.number()]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("preferences individual unionOneOf over global setting", () => {
    const expected: Schema = {
      anyOf: [
        {
          type: "string",
        },
        {
          type: "number",
        },
      ],
    };
    const schema = v.pipe(
      v.union([v.string(), v.number()]),
      v.metadata({ unionOneOf: false })
    );

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });

  it("ignores optional values in a union", () => {
    const expected: Schema = {
      anyOf: [
        {
          type: "string",
        },
      ],
    };
    const schema = v.union([v.string(), v.undefined(), v.never()]);

    const result = createSchema(schema);

    expect(result.schema).toStrictEqual(expected);
  });
});
