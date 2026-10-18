# Changelog
## 1.4.0

### New Features ✨

- (openapi) Resolve `resolver()` schemas in headers by @MichaelDeBoey in [#283](https://github.com/rhinobase/hono-openapi/pull/283)

### Bug Fixes 🐛

#### Openapi

- Resolve default schemas for validator routes by @MathurAditya724 in [#290](https://github.com/rhinobase/hono-openapi/pull/290)
- Apply `defaultOptions` once per operation by @MichaelDeBoey in [#289](https://github.com/rhinobase/hono-openapi/pull/289)
- Preserve payloads and simplify schema generation by @MathurAditya724 in [#281](https://github.com/rhinobase/hono-openapi/pull/281)
- Describe the default response of a route that documents none by @MichaelDeBoey in [#280](https://github.com/rhinobase/hono-openapi/pull/280)
- Document each path a route with optional parameters serves by @MichaelDeBoey in [#272](https://github.com/rhinobase/hono-openapi/pull/272)
- Convert response schemas as output by @MichaelDeBoey in [#271](https://github.com/rhinobase/hono-openapi/pull/271)
- Give a response its own component when its shape differs by @MichaelDeBoey in [#278](https://github.com/rhinobase/hono-openapi/pull/278)
- Don't publish a named query schema whose fields are inlined by @MichaelDeBoey in [#277](https://github.com/rhinobase/hono-openapi/pull/277)
- Keep generated operation IDs unique by @MichaelDeBoey in [#276](https://github.com/rhinobase/hono-openapi/pull/276)
- Mark a parameter deprecated when its field is by @MichaelDeBoey in [#275](https://github.com/rhinobase/hono-openapi/pull/275)
- Document both encodings a form validator accepts by @MichaelDeBoey in [#274](https://github.com/rhinobase/hono-openapi/pull/274)
- Document the parameters of a union query schema by @MichaelDeBoey in [#273](https://github.com/rhinobase/hono-openapi/pull/273)
- Keep a `required` the route describes over the validator's by @MichaelDeBoey in [#269](https://github.com/rhinobase/hono-openapi/pull/269)

#### Other

- (routes) Keep optional operation IDs unique by @MathurAditya724 in [#286](https://github.com/rhinobase/hono-openapi/pull/286)
- (schema) Share component reference traversal by @MathurAditya724 in [#287](https://github.com/rhinobase/hono-openapi/pull/287)
- (validator) Mark a request body required only when the route needs it by @MichaelDeBoey in [#261](https://github.com/rhinobase/hono-openapi/pull/261)

### Documentation 📚

- Add Craft pull request guidance by @MathurAditya724 in [#285](https://github.com/rhinobase/hono-openapi/pull/285)

## 1.3.5

### Bug Fixes 🐛

- (openapi) Find routes described by another copy of the package by @MichaelDeBoey in [#257](https://github.com/rhinobase/hono-openapi/pull/257)

## 1.3.4

### Bug Fixes 🐛

- (openapi) Drop components only hidden or excluded routes use by @MichaelDeBoey in [#255](https://github.com/rhinobase/hono-openapi/pull/255)

## 1.3.3

### Bug Fixes 🐛

- Preserve multiple request body media types by @MathurAditya724 in [#250](https://github.com/rhinobase/hono-openapi/pull/250)
- Harden schema generation with adapter behavior tests by @MathurAditya724 in [#249](https://github.com/rhinobase/hono-openapi/pull/249)

### Internal Changes 🔧

- Cover Zod v4 component schemas by @MathurAditya724 in [#251](https://github.com/rhinobase/hono-openapi/pull/251)

## 1.3.2

### New Features ✨

- Auto-include 400 validation error response when validator() is used by @MathurAditya724 in [#226](https://github.com/rhinobase/hono-openapi/pull/226)

### Bug Fixes 🐛

#### Openapi

- Resolve manual request body schemas by @MathurAditya724 in [#246](https://github.com/rhinobase/hono-openapi/pull/246)
- Generate parameters from allOf schemas by @MathurAditya724 in [#245](https://github.com/rhinobase/hono-openapi/pull/245)

#### Other

- (deps) Ship runtime dependencies by @MathurAditya724 in [#244](https://github.com/rhinobase/hono-openapi/pull/244)
- Lift leftover $defs into components.schemas for Effect Schema (#227) by @MathurAditya724 in [#242](https://github.com/rhinobase/hono-openapi/pull/242)
- Path context matching should use prefix comparison instead of regex by @MathurAditya724 in [#225](https://github.com/rhinobase/hono-openapi/pull/225)
- Preserve zod-derived types in validator() RPC inference by @MathurAditya724 in [#236](https://github.com/rhinobase/hono-openapi/pull/236)
- Name generated middleware functions for clearer tracing by @MathurAditya724 in [#235](https://github.com/rhinobase/hono-openapi/pull/235)

### Internal Changes 🔧

- Add craft release system by @MathurAditya724 in [#241](https://github.com/rhinobase/hono-openapi/pull/241)

### Other

- Allow @hono/standard-validator 0.3 as a peer by @smorimoto in [#240](https://github.com/rhinobase/hono-openapi/pull/240)
- released v1.3.1 by @MathurAditya724 in [b4230ca6](https://github.com/rhinobase/hono-openapi/commit/b4230ca621ed17be2fc5b7419f0af2a392680ea5)

