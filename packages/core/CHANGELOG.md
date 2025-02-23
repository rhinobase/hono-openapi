## 0.4.5 (2025-02-23)

### 🩹 Fixes

- update requestBody content type for form submissions ([c34919c](https://github.com/rhinobase/hono-openapi/commit/c34919c))
- **core/toOpenAPISchema:** "`anyOf` enum schema is lost" attempt ([#53](https://github.com/rhinobase/hono-openapi/pull/53))
- **core:** replace arktype schema validation with assert method ([b76cc84](https://github.com/rhinobase/hono-openapi/commit/b76cc84))
- **core:** optimize generateOperationId ([0561f7c](https://github.com/rhinobase/hono-openapi/commit/0561f7c))
- **core:** allow to use validator repeatedly - merge parameters ([#64](https://github.com/rhinobase/hono-openapi/pull/64))
- **core:** include generateRouteSpecs in exports ([7654bd5](https://github.com/rhinobase/hono-openapi/commit/7654bd5))

## 0.4.4 (2025-01-29)

### 🩹 Fixes

- **core:** update exports in index.ts to include utils ([e0496d6](https://github.com/rhinobase/hono-openapi/commit/e0496d6))
- **core:** enhance HTTPException handling and update validateResponse type ([02562ed](https://github.com/rhinobase/hono-openapi/commit/02562ed))
- **core:** add jsdocs for uniqueSymbol and generateValidatorDocs ([7451f38](https://github.com/rhinobase/hono-openapi/commit/7451f38))

## 0.4.3 (2025-01-20)

This was a version bump only for core to align it with other projects, there were no code changes.

## 0.4.2 (2025-01-20)

### 🚀 Features

- **core:** Add the cause of validation error to HTTPException ([62a0876](https://github.com/rhinobase/hono-openapi/commit/62a0876))

### 🩹 Fixes

- **core:** minor type corrections ([9cea732](https://github.com/rhinobase/hono-openapi/commit/9cea732))
- **core:** update TypeScript configuration for build process ([529d5c5](https://github.com/rhinobase/hono-openapi/commit/529d5c5))
- **core:** clone response before reading data for validation ([7bc444a](https://github.com/rhinobase/hono-openapi/commit/7bc444a))
- **core:** corrected rollup config ([c7aceab](https://github.com/rhinobase/hono-openapi/commit/c7aceab))

## 0.4.1 (2025-01-15)

### 🩹 Fixes

- **core:** corrected rollup config ([c7aceab](https://github.com/rhinobase/hono-openapi/commit/c7aceab))

## 0.4.0 (2025-01-14)

### 🚀 Features

- add default options support ([#43](https://github.com/rhinobase/hono-openapi/pull/43))
- seprated the generation function ([0aa04f0](https://github.com/rhinobase/hono-openapi/commit/0aa04f0))
- **core:** support effect schema ([#16](https://github.com/rhinobase/hono-openapi/pull/16))

### 🩹 Fixes

- **core:** remove unnecessary omit from DescribeRouteOptions type ([#32](https://github.com/rhinobase/hono-openapi/pull/32))
- corrected filterPaths function ([3fc05f5](https://github.com/rhinobase/hono-openapi/commit/3fc05f5))
- improved the types for describeRoute ([6bfa7b4](https://github.com/rhinobase/hono-openapi/commit/6bfa7b4))
- **core:** corrected the validation function ([#24](https://github.com/rhinobase/hono-openapi/pull/24))
- **core:** duplicates path and param validation ([#19](https://github.com/rhinobase/hono-openapi/pull/19))

## 0.3.1 (2024-12-24)

### 🚀 Features

- **core:** support effect schema ([#16](https://github.com/rhinobase/hono-openapi/pull/16))

### 🩹 Fixes

- corrected filterPaths function ([3fc05f5](https://github.com/rhinobase/hono-openapi/commit/3fc05f5))
- improved the types for describeRoute ([6bfa7b4](https://github.com/rhinobase/hono-openapi/commit/6bfa7b4))
- **core:** corrected the validation function ([#24](https://github.com/rhinobase/hono-openapi/pull/24))
- **core:** duplicates path and param validation ([#19](https://github.com/rhinobase/hono-openapi/pull/19))

## 0.3.0 (2024-12-21)

### 🚀 Features

- **core:** support effect schema ([#16](https://github.com/rhinobase/hono-openapi/pull/16))

### 🩹 Fixes

- **core:** corrected the validation function ([#24](https://github.com/rhinobase/hono-openapi/pull/24))
- **core:** duplicates path and param validation ([#19](https://github.com/rhinobase/hono-openapi/pull/19))
- resolved biome errors ([9f57d0f](https://github.com/rhinobase/hono-openapi/commit/9f57d0f))

## 0.2.1 (2024-12-03)

### 🩹 Fixes

- **core:** resolved json to openapi conversion issue ([8e7407a](https://github.com/rhinobase/hono-openapi/commit/8e7407a))
- **core:** parameter was not getting marked required ([0958652](https://github.com/rhinobase/hono-openapi/commit/0958652))

## 0.2.0 (2024-12-02)

### 🚀 Features

- **core:** added responseValidation and made hide a function ([7896d99](https://github.com/rhinobase/hono-openapi/commit/7896d99))
- **core:** added arktype and typebox ([05f6718](https://github.com/rhinobase/hono-openapi/commit/05f6718))
- **core:** added valibot ([148c8ea](https://github.com/rhinobase/hono-openapi/commit/148c8ea))

### 🩹 Fixes

- **core:** resolved issues ([b9ab16a](https://github.com/rhinobase/hono-openapi/commit/b9ab16a))
- **core:** passed the schemaType metadata in the resolver ([63def23](https://github.com/rhinobase/hono-openapi/commit/63def23))

## 0.1.5 (2024-11-10)

### 🩹 Fixes

- **core:** passed the schemaType metadata in the resolver ([63def23](https://github.com/rhinobase/hono-openapi/commit/63def23))

## 0.1.4 (2024-11-07)

This was a version bump only for core to align it with other projects, there were no code changes.

## 0.1.3 (2024-11-07)

This was a version bump only for core to align it with other projects, there were no code changes.

## 0.1.2 (2024-11-07)

### 🩹 Fixes

- **core:** improved package size ([a286576](https://github.com/rhinobase/hono-openapi/commit/a286576))

## 0.1.1 (2024-11-07)

This was a version bump only for core to align it with other projects, there were no code changes.

## 0.1.0 (2024-11-07)

### 🚀 Features

- **core:** implmented the hide route functionality ([0d67ea3](https://github.com/rhinobase/hono-openapi/commit/0d67ea3))
- **core:** working on a new implementation ([752ce23](https://github.com/rhinobase/hono-openapi/commit/752ce23))
- **core:** added support for components ([3eb7d50](https://github.com/rhinobase/hono-openapi/commit/3eb7d50))
- **core:** added funtionality for docs and validation ([d8dfaea](https://github.com/rhinobase/hono-openapi/commit/d8dfaea))
- **core:** implmenting features ([c8cacc3](https://github.com/rhinobase/hono-openapi/commit/c8cacc3))
- **sb:** init commit ([42977a6](https://github.com/rhinobase/hono-openapi/commit/42977a6))
- **core:** added base implmentation ([1f0521c](https://github.com/rhinobase/hono-openapi/commit/1f0521c))
- **core:** init commit ([46af4b1](https://github.com/rhinobase/hono-openapi/commit/46af4b1))

### 🩹 Fixes

- **core:** improved the logic ([b387733](https://github.com/rhinobase/hono-openapi/commit/b387733))
- **core:** corrected the base implmentation ([a28fa26](https://github.com/rhinobase/hono-openapi/commit/a28fa26))
- **core:** removed validation ([c4b8cf7](https://github.com/rhinobase/hono-openapi/commit/c4b8cf7))
- **core:** added resolvers ([0ae9fb7](https://github.com/rhinobase/hono-openapi/commit/0ae9fb7))