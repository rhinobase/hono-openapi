import type { Context } from "hono";
import type { RouterRoute, ValidationTargets } from "hono/types";
import type { OpenAPIV3_1 } from "openapi-types";
import type { resolver } from "./middlewares.js";
import type { AllowedMethods } from "./utils.js";

export type PromiseOr<T> = T | Promise<T>;

export type ResolverReturnType = ReturnType<typeof resolver> & {
  options?: {
    /**
     * Override the media type of the request body, if not specified, it will be `application/json` for `json` target and `multipart/form-data` for `form` target.
     */
    media?: string;
  } & { [key: string]: unknown };
};

export type HandlerUniqueProperty =
  | (ResolverReturnType & {
    target: keyof ValidationTargets;
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

type OperationId = string | ((route: RouterRoute) => string);

export type DescribeRouteOptions = Omit<
  OpenAPIV3_1.OperationObject,
  "responses" | "parameters" | "operationId"
> & {
  operationId?: OperationId;
  /**
   * Pass `true` to hide route from OpenAPI/swagger document
   */
  hide?:
  | boolean
  | ((props: {
    c?: Context;
    method: string;
    path: string;
  }) => boolean);
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
  specs?: DescribeRouteOptions & {
    operationId?: OperationId;
  };
  paths: Partial<OpenAPIV3_1.PathsObject>;
};

type HaveDefaultValues =
  | "documentation"
  | "excludeStaticFile"
  | "exclude"
  | "excludeMethods"
  | "excludeTags";

type SanitizedGenerateSpecOptions = Pick<
  GenerateSpecOptions,
  HaveDefaultValues
> &
  Omit<Partial<GenerateSpecOptions>, HaveDefaultValues>;

export type SpecContext = {
  components: OpenAPIV3_1.ComponentsObject;
  options: SanitizedGenerateSpecOptions;
};
