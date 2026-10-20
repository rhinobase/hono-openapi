import type { ToOpenAPISchemaContext } from "@standard-community/standard-openapi";
import type { Context } from "hono";
import type { RouterRoute, ValidationTargets } from "hono/types";
import type { OpenAPIV3_1 } from "openapi-types";
import type { resolver } from "./middlewares.js";
import type { AllowedMethods } from "./utils.js";

export type PromiseOr<T> = T | Promise<T>;

/**
 * Whether a schema describes what a route accepts (`input`) or what it
 * sends (`output`). They differ for schemas with defaults or transforms.
 */
export type SchemaDirection = "input" | "output";

export type ResolverReturnType = ReturnType<typeof resolver> & {
  options?: {
    /**
     * Override the media type of the request body, if not specified, it will be `application/json` for `json` target and `multipart/form-data` for `form` target.
     */
    media?: string;
  } & Partial<ToOpenAPISchemaContext>;
};

export type HandlerUniqueProperty =
  | (ResolverReturnType & {
      target: keyof ValidationTargets;
    })
  | {
      spec: DescribeRouteOptions;
    };

/**
 * A header object that accepts resolver() output in its schema.
 */
type HeaderObjectWithResolver = Omit<OpenAPIV3_1.HeaderObject, "schema"> & {
  schema?:
    | OpenAPIV3_1.ReferenceObject
    | OpenAPIV3_1.SchemaObject
    | ResolverReturnType;
};

/**
 * A headers map that accepts resolver() output in its headers' schemas.
 */
export type HeadersWithResolver = {
  [header: string]: HeaderObjectWithResolver | OpenAPIV3_1.ReferenceObject;
};

/**
 * An encoding object whose headers accept resolver() output in their schemas.
 */
type EncodingObjectWithResolver = Omit<
  OpenAPIV3_1.EncodingObject,
  "headers"
> & {
  headers?: HeadersWithResolver;
};

/**
 * A media type object that accepts resolver() output in addition to standard schema types,
 * in its schema and in its encoding's headers.
 */
type MediaTypeObjectWithResolver = Omit<
  OpenAPIV3_1.MediaTypeObject,
  "encoding" | "schema"
> & {
  encoding?: { [property: string]: EncodingObjectWithResolver };
  schema?:
    | OpenAPIV3_1.ReferenceObject
    | OpenAPIV3_1.SchemaObject
    | ResolverReturnType;
};

export type ContentWithResolver = {
  [media: string]: MediaTypeObjectWithResolver;
};

/**
 * A response object that accepts resolver() output in schema positions.
 */
type ResponseObjectWithResolver =
  | (Omit<OpenAPIV3_1.ResponseObject, "content" | "headers"> & {
      content?: ContentWithResolver;
      headers?: HeadersWithResolver;
    })
  | OpenAPIV3_1.ReferenceObject;

type RequestBodyObjectWithResolver =
  | (Omit<OpenAPIV3_1.RequestBodyObject, "content"> & {
      content: ContentWithResolver;
    })
  | OpenAPIV3_1.ReferenceObject;

/**
 * A responses map that accepts resolver() output in schema positions.
 */
export type ResponsesWithResolver = {
  [key: string]: ResponseObjectWithResolver;
};

/**
 * Extended document type that allows resolver() in documentation.components.responses
 */
type DocumentWithResolver = Omit<
  Partial<OpenAPIV3_1.Document>,
  | "x-express-openapi-additional-middleware"
  | "x-express-openapi-validation-strict"
  | "components"
> & {
  components?: Omit<OpenAPIV3_1.ComponentsObject, "responses"> & {
    responses?: ResponsesWithResolver;
  };
};

export type GenerateSpecOptions = {
  /**
   * Customize OpenAPI config, refers to Swagger 2.0 config
   *
   * @see https://swagger.io/specification/v2/
   */
  documentation: DocumentWithResolver;

  /**
   * Include paths which don't have the handlers.
   * This is useful when you want to document the
   * API without implementing it or index all the paths.
   */
  includeEmptyPaths: boolean;

  /**
   * Document routes hidden with `hide` as if they weren't hidden, components
   * included. This is useful for a second, internal document next to the
   * public one, without changing any route's `hide`.
   *
   * @default false
   */
  includeHiddenRoutes: boolean;

  /**
   * Determine if Swagger should exclude static files (by checking if the last path segment contains a period).
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

  /**
   * Automatically include a 400 validation error response for routes
   * that use `validator()`. Set to `false` to disable, `true` to use
   * the built-in schema, or provide a custom `ResponseObject`.
   *
   * @default true
   */
  defaultValidationErrorResponse: boolean | OpenAPIV3_1.ResponseObject;
};

type OperationId = string | ((route: RouterRoute) => string);

export type DescribeRouteOptions = Omit<
  OpenAPIV3_1.OperationObject,
  "requestBody" | "responses" | "operationId"
> & {
  operationId?: OperationId;
  /**
   * Request body metadata. `resolver()` values are converted to OpenAPI
   * schemas while generating the document.
   */
  requestBody?: RequestBodyObjectWithResolver;
  /**
   * Pass `true` to hide route from OpenAPI/swagger document
   */
  hide?:
    | boolean
    | ((props: { c?: Context; method: string; path: string }) => boolean);
  /**
   * Responses of the request
   */
  responses?: ResponsesWithResolver;
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
  | "excludeTags"
  | "defaultValidationErrorResponse";

type SanitizedGenerateSpecOptions = Pick<
  GenerateSpecOptions,
  HaveDefaultValues
> &
  Omit<Partial<GenerateSpecOptions>, HaveDefaultValues>;

export type SpecContext = {
  components: OpenAPIV3_1.ComponentsObject;
  options: SanitizedGenerateSpecOptions;
  validationErrorResponse?: OpenAPIV3_1.ResponseObject;
};
