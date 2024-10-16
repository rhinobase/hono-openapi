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

export type HonoOpenAPISchema = {
  schema: OpenAPIV3.SchemaObject;
  validator: <T>(data: unknown) => T | { error: string };
};

export type DescribeRouteOptions = Partial<
  Omit<OpenAPIV3.OperationObject, "responses" | "requestBody">
> & {
  /**
   * Pass `true` to hide route from OpenAPI/swagger document
   */
  hide?: boolean;

  /**
   * Parameters of the request
   */
  request?: {
    cookie?: HonoOpenAPISchema;
    header?: HonoOpenAPISchema;
    param?: HonoOpenAPISchema;
    query?: HonoOpenAPISchema;
  };

  /**
   * Request body of the request
   */
  requestBody?: OpenAPIV3.RequestBodyObject & {
    content: {
      [key: string]: OpenAPIV3.MediaTypeObject & {
        schema: OpenAPIV3.SchemaObject | HonoOpenAPISchema;
      };
    };
  };

  /**
   * Responses of the request
   */
  responses?: {
    [key: string]: OpenAPIV3.ResponseObject & {
      content: {
        [key: string]: OpenAPIV3.MediaTypeObject & {
          schema: OpenAPIV3.SchemaObject | HonoOpenAPISchema;
        };
      };
    };
  };
};

export interface OpenAPIRoute {
  path: string;
  method: string;
  data: DescribeRouteOptions;
}
