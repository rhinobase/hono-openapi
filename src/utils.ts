import type { ValidationTargets } from "hono";
import type { OpenAPIV3 } from "openapi-types";
import type { ResolverResult } from "./types.js";

/**
 * The unique symbol for the middlewares, which makes it easier to identify them. Not meant to be used directly, unless you're creating a custom middleware.
 */
export const uniqueSymbol = Symbol("openapi");

/**
 * Generate OpenAPI docs for a validator middleware. Not meant to be used directly, unless you're creating a custom middleware.
 */
export async function generateValidatorDocs<
  Target extends keyof ValidationTargets,
>(target: Target, _result: ReturnType<ResolverResult["builder"]>) {
  const result = await _result;
  const docs: Pick<OpenAPIV3.OperationObject, "parameters" | "requestBody"> =
    {};

  if (target === "form" || target === "json") {
    const media =
      target === "json" ? "application/json" : "multipart/form-data";
    if (
      !docs.requestBody ||
      !("content" in docs.requestBody) ||
      !docs.requestBody.content
    ) {
      docs.requestBody = {
        content: {
          [media]: {
            schema: result.schema,
          },
        },
      };
    } else {
      docs.requestBody.content[media] = {
        schema: result.schema,
      };
    }
  } else {
    const parameters: (
      | OpenAPIV3.ReferenceObject
      | OpenAPIV3.ParameterObject
    )[] = [];

    if ("$ref" in result.schema) {
      parameters.push({
        in: target,
        name: result.schema.$ref,
        schema: result.schema,
      });
    } else {
      for (const [key, value] of Object.entries(
        result.schema.properties ?? {},
      )) {
        parameters.push({
          in: target,
          name: key,
          schema: value,
          required: result.schema.required?.includes(key),
        });
      }
    }

    docs.parameters = parameters;
  }

  return { docs, components: result.components };
}
