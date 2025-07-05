import type { Context } from "hono";
import type { RouterRoute, ValidationTargets } from "hono/types";
import type { OpenAPIV3_1 } from "openapi-types";
import type { resolver } from "./middlewares.js";
import type { AllowedMethods } from "./utils.js";

export type PromiseOr<T> = T | Promise<T>;

export type ResolverReturnType = ReturnType<typeof resolver>;

export type HandlerUniqueProperty =
  | (ResolverReturnType & {
      target: keyof ValidationTargets;
      options?: Record<string, unknown>;
    })
  | {
      spec: DescribeRouteOptions;
    };

export type GenerateSpecOptions = {
  /**
   * Customize OpenAPI config, refers to Swagger 2.0 config
   *
   * @see https://swagger.io/specification/v2/
   */
  documentation: Omit<
    Partial<OpenAPIV3_1.Document>,
    | "x-express-openapi-additional-middleware"
    | "x-express-openapi-validation-strict"
  >;

  /**
   * Include paths which don't have the handlers.
   * This is useful when you want to document the
   * API without implementing it or index all the paths.
   */
  includeEmptyPaths: boolean;

  /**
   * Determine if Swagger should exclude static files.
   *
   * @default true
   */
  excludeStaticFile: boolean;

  /**
   * Paths to exclude from OpenAPI endpoint
   *
   * @default []
   */
  exclude: string | RegExp | Array<string | RegExp>;

  /**
   * Exclude methods from the specs
   */
  excludeMethods: AllowedMethods[];

  /**
   * Exclude tags from OpenAPI
   */
  excludeTags: string[];

  /**
   * Default options for `describeRoute` method
   */
  defaultOptions: Partial<Record<AllowedMethods | "ALL", DescribeRouteOptions>>;
};

type HaveDefaultValues =
  | "documentation"
  | "excludeStaticFile"
  | "exclude"
  | "excludeMethods"
  | "excludeTags";

export type SanitizedGenerateSpecOptions = Pick<
  GenerateSpecOptions,
  HaveDefaultValues
> &
  Omit<Partial<GenerateSpecOptions>, HaveDefaultValues>;

export type DescribeRouteOptions = Omit<
  OpenAPIV3_1.OperationObject,
  "responses" | "parameters"
> & {
  /**
   * Pass `true` to hide route from OpenAPI/swagger document
   */
  hide?: boolean | ((c: Context) => boolean);
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
};

export type RegisterSchemaPathOptions = {
  route: RouterRoute;
  specs?:
    | DescribeRouteOptions
    | Pick<OpenAPIV3_1.OperationObject, "parameters" | "requestBody">;
  paths: Partial<OpenAPIV3_1.PathsObject>;
};
