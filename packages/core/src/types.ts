import type { Env, MiddlewareHandler, ValidationTargets } from "hono";
import type { OpenAPIV3 } from "openapi-types";

export type ResolverResult = {
  builder: (options?: Record<string, unknown>) => {
    schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
    components?: OpenAPIV3.ComponentsObject;
  };
  validator?: <
    E extends Env,
    P extends string,
    Target extends keyof ValidationTargets = keyof ValidationTargets
  >(
    target: Target
  ) => MiddlewareHandler<E, P>;
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
    cookie?: ResolverResult;
    header?: ResolverResult;
    param?: ResolverResult;
    query?: ResolverResult;
  };

  /**
   * Request body of the request
   */
  requestBody?: OpenAPIV3.RequestBodyObject & {
    content: {
      [key: string]: Omit<OpenAPIV3.MediaTypeObject, "schema"> & {
        schema?:
          | OpenAPIV3.ReferenceObject
          | OpenAPIV3.SchemaObject
          | ResolverResult;
      };
    };
  };

  /**
   * Responses of the request
   */
  responses?: {
    [key: string]: OpenAPIV3.ResponseObject & {
      content: {
        [key: string]: Omit<OpenAPIV3.MediaTypeObject, "schema"> & {
          schema?:
            | OpenAPIV3.ReferenceObject
            | OpenAPIV3.SchemaObject
            | ResolverResult;
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
