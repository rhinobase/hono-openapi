import { describe, expectTypeOf, it } from "vitest";
import z from "zod/v4";
import { resolver } from "../middlewares.js";
import type { ValidatorOptions } from "../types.js";

describe("validationErrorResponse types", () => {
  it("takes a response, with `resolver()` schemas, a reference or `false`", () => {
    const options: ValidatorOptions[] = [
      {
        validationErrorResponse: {
          content: {
            "application/json": {
              schema: resolver(z.object({ title: z.string() })),
            },
          },
          description: "The pet is invalid",
        },
      },
      {
        validationErrorResponse: { $ref: "#/components/responses/PetProblem" },
      },
      { media: "application/merge-patch+json", validationErrorResponse: false },
    ];

    expectTypeOf(options).toEqualTypeOf<ValidatorOptions[]>();
  });

  it("rejects `true`, which is what leaving it out means", () => {
    const options: ValidatorOptions = {
      // @ts-expect-error leave it out to document `defaultValidationErrorResponse`
      validationErrorResponse: true,
    };

    expectTypeOf(options).toEqualTypeOf<ValidatorOptions>();
  });
});
