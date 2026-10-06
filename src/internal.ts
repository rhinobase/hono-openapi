import type { OpenAPIV3_1 } from "openapi-types";

export const componentsSymbol = Symbol("hono-openapi.components");

type SpecWithComponents = object & {
  [componentsSymbol]?: OpenAPIV3_1.ComponentsObject[];
};

export function setSpecComponents(
  spec: object,
  components: OpenAPIV3_1.ComponentsObject[],
) {
  Object.defineProperty(spec, componentsSymbol, {
    configurable: true,
    enumerable: false,
    value: components,
  });
}

export function getSpecComponents(spec: object | undefined) {
  return (spec as SpecWithComponents | undefined)?.[componentsSymbol] ?? [];
}
