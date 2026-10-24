import { describe, expectTypeOf, it } from "vitest";
import type { DescribeRouteOptions } from "../types.js";

describe("operation extension types", () => {
  it("takes an `x-` key in `describeRoute` options", () => {
    const options: DescribeRouteOptions = {
      "x-internal": true,
      summary: "List pets",
    };

    expectTypeOf(options["x-internal"]).toBeUnknown();
  });

  it("still rejects a key that is neither an operation field nor an extension", () => {
    const options: DescribeRouteOptions = {
      // @ts-expect-error `internal` is not a field of an operation
      internal: true,
      summary: "List pets",
    };

    expectTypeOf(options).toEqualTypeOf<DescribeRouteOptions>();
  });
});
