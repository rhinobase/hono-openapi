import type { ResolverReturnType, DescribeRouteOptions } from "../../types";

export function defineCommonTestRouteSpec(
  responseSchema: ResolverReturnType,
): DescribeRouteOptions {
  return {
    tags: ["test"],
    summary: "Test route",
    description: "This is a test route",
    parameters: [
      {
        name: "id",
        in: "param",
        description: "The ID of the item",
        example: "4daec17a-9ed2-40d2-b577-22bb89b96071",
        required: true,
        schema: {
          type: "string",
        },
      },
      {
        name: "category",
        in: "query",
        description: "The category of the item",
        example: "one",
        required: false,
      },
    ],
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: responseSchema,
          },
        },
      },
    },
  };
}
