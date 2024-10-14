import type { OpenAPIV3 } from "openapi-types";

export type OpenApiSpecsOptions = {
  /**
   * Customize OpenAPI config, refers to Swagger 2.0 config
   *
   * @see https://swagger.io/specification/v2/
   */
  documentation?: Omit<
    Partial<OpenAPIV3.Document>,
    | "x-express-openapi-additional-middleware"
    | "x-express-openapi-validation-strict"
  >;

  /**
   * Determine if Swagger should exclude static files.
   *
   * @default true
   */
  excludeStaticFile?: boolean;

  /**
   * Paths to exclude from OpenAPI endpoint
   *
   * @default []
   */
  exclude?: string | RegExp | Array<string | RegExp>;

  /**
   * Exclude methods from Open API
   */
  excludeMethods?: string[];

  /**
   * Exclude tags from OpenAPI
   */
  excludeTags?: string[];
};

export type DescribeRouteOptions = Partial<OpenAPIV3.OperationObject> & {
  /**
   * Pass `true` to hide route from OpenAPI/swagger document
   */
  hide?: boolean;
};

export interface OpenAPIRoute {
  path: string;
  method: string;
  data: DescribeRouteOptions;
}
