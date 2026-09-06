# Changelog
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

