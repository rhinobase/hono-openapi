# Reporting Security Issues

If you believe you have found a security vulnerability, we encourage you to let us know right away.

We will investigate all legitimate reports and do our best to quickly fix the problem.

Email <support@rhinobase.io> to disclose any security vulnerabilities.

## Dependency security

### Zod 3 compatibility

Zod 3 support is retained. The upstream advisory
[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
currently marks Zod versions below 4.6.6 as affected by resource exhaustion
while validating large collections. The latest Zod 3 release is 3.25.76;
upstream has not published a patched Zod 3 release.

Upgrading build and test dependencies does not resolve this advisory for an
application that validates untrusted input with Zod 3. Applications should
limit request sizes before parsing and use a patched validator when compatible.
Do not treat a successful test run or a development lockfile update as evidence
that a consuming application's validator is patched.

The advisory remains visible in dependency audits. It is not suppressed, and
Zod 3 is not silently replaced with Zod 4.

### Hono applications

`validator()` delegates input validation to the supplied Standard Schema
validator. The Zod guidance above therefore applies when a Zod schema is used
for request validation. Use a patched Hono 4 release in the consuming
application as well; the repository tests use Hono 4.13.11 or newer without
raising the public peer dependency's minimum version.
