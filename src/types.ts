import type { Context } from "hono";
import type { RouterRoute, ValidationTargets } from "hono/types";
import type { OpenAPIV3_1 } from "openapi-types";
import type { resolver } from "./middlewares.js";
import type { ALLOWED_METHODS } from "./utils.js";

export type PromiseOr<T> = T | Promise<T>;

export type ResolverReturnType = ReturnType<typeof resolver>;

export type HandlerResponse =
  | (ResolverReturnType & {
    target: keyof ValidationTargets;
    options?: Record<string, unknown>;
  })
  | { specs: DescribeRouteOptions };

export type DescribeRouteOptions =
  & Omit<
    OpenAPIV3_1.OperationObject,
    "responses" | "parameters"
  >
  & {
    /**
     * Pass `true` to hide route from OpenAPI/swagger document
     */
    hide?:
      | boolean
      | ((
        c: Context,
      ) => boolean);

    /**
     * Responses of the request
     */
    responses?: {
      [key: string]:
        | (OpenAPIV3_1.ResponseObject & {
          content?: {
            [key: string]: Omit<OpenAPIV3_1.MediaTypeObject, "schema"> & {
              schema?:
                | OpenAPIV3_1.ReferenceObject
                | OpenAPIV3_1.SchemaObject
                | ResolverReturnType;
            };
          };
        })
        | OpenAPIV3_1.ReferenceObject;
    };

    /**
     * Parameters of the request
     */
    parameters?: (
      | OpenAPIV3_1.ParameterObject
      | (OpenAPIV3_1.ParameterObject & {
        schema: ResolverReturnType;
      })
    )[];
  };

export interface OpenAPIRoute {
  route: RouterRoute;
  data?:
    | DescribeRouteOptions
    | Pick<OpenAPIV3_1.OperationObject, "parameters" | "requestBody">;
}

export type OpenApiSpecsOptions = {
  /**
   * Customize OpenAPI config, refers to Swagger 2.0 config
   *
   * @see https://swagger.io/specification/v2/
   */
  documentation?: Omit<
    Partial<OpenAPIV3_1.Document>,
    | "x-express-openapi-additional-middleware"
    | "x-express-openapi-validation-strict"
  >;

  /**
   * Include paths which don't have the handlers.
   * This is useful when you want to document the
   * API without implementing it or index all the paths.
   */
  includeEmptyPaths?: boolean;

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
  excludeMethods?: (typeof ALLOWED_METHODS)[number][];

  /**
   * Exclude tags from OpenAPI
   */
  excludeTags?: string[];

  /**
   * Default options for `describeRoute` method
   */
  defaultOptions?: Partial<
    Record<(typeof ALLOWED_METHODS)[number] | "ALL", DescribeRouteOptions>
  >;
};
