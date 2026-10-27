import { describe, expectTypeOf, it } from "vitest";
import z from "zod/v4";
import { resolver } from "../middlewares.js";
import type { GenerateSpecOptions } from "../types.js";

describe("webhook resolver types", () => {
  it("takes a resolver() in a webhook's request body and responses", () => {
    const schema = resolver(z.object({ petId: z.string() }));
    const documentation: GenerateSpecOptions["documentation"] = {
      webhooks: {
        "pet.adopted": {
          post: {
            requestBody: { content: { "application/json": { schema } } },
            responses: {
              200: {
                content: { "application/json": { schema } },
                description: "Received",
              },
            },
          },
        },
      },
    };

    expectTypeOf(documentation.webhooks).not.toBeUndefined();
  });
});
