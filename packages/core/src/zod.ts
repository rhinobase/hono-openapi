import type z from "zod";
import type { OpenAPIV3 } from "openapi-types";

export function zodResolver<T extends z.AnyZodObject>(
  type: "query" | "header" | "path" | "cookie",
  schema: T
) {
  const params: OpenAPIV3.ParameterObject[] = [];

  for (const key in schema.shape) {
    const field = schema.shape[key];

    const param: OpenAPIV3.ParameterObject = {
      name: key,
      in: type,
      description: field._def.description,
      required: !field.isNullable(),
      schema: {
        type: typeToName(field._def.typeName),
      },
    };

    params.push(param);
  }

  return params;
}

function typeToName(type: string) {
  switch (type) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return "number";
    default:
      return undefined;
  }
}
