import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

// Building, packing, and registry downloads can exceed the default five seconds.
describe("package installation", { timeout: 60_000 }, () => {
  it("imports and types QUERY after installation without auto-installed peers", async () => {
    const tempDirectory = await mkdtemp(
      join(tmpdir(), "hono-openapi-package-"),
    );
    const packageDirectory = join(tempDirectory, "package");
    const consumerDirectory = join(tempDirectory, "consumer");

    try {
      await mkdir(packageDirectory);
      await execFileAsync(pnpm, ["build"], { cwd: projectRoot });
      await execFileAsync(
        pnpm,
        ["pack", "--pack-destination", packageDirectory],
        {
          cwd: projectRoot,
        },
      );

      const [tarball] = await readdir(packageDirectory);
      expect(tarball).toMatch(/^hono-openapi-.*\.tgz$/);

      await mkdir(consumerDirectory);
      await writeFile(
        join(consumerDirectory, "package.json"),
        JSON.stringify({
          name: "hono-openapi-consumer",
          private: true,
          type: "module",
          dependencies: {
            hono: "^4.11.2",
            "openapi-types": "^12.1.3",
            "hono-openapi": `file:../package/${tarball}`,
          },
        }),
      );

      await execFileAsync(
        pnpm,
        ["install", "--config.auto-install-peers=false"],
        { cwd: consumerDirectory },
      );
      const { stderr } = await execFileAsync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          "import { createRequire } from 'node:module'; const esm = await import('hono-openapi'); const cjs = createRequire(import.meta.url)('hono-openapi'); if (!esm.generateSpecs || !cjs.generateSpecs) process.exit(1)",
        ],
        { cwd: consumerDirectory },
      );

      expect(stderr).toBe("");

      // Check the declarations consumers actually install, not source-only types.
      const consumerSource = `import { Hono } from "hono";
import { generateSpecs, describeRoute, type AllowedMethods } from "hono-openapi";
import type { OpenAPIV3_1 } from "openapi-types";
async function checkQueryTypes() {
const method: AllowedMethods = "QUERY";
const ok = { responses: { 200: { description: "OK" } } };
const callback = { "{$request.body#/callbackUrl}": { query: ok } };
const app = new Hono().on(method, "/search", describeRoute({ ...ok, callbacks: { result: callback } }), c => c.json({}));
const specs = await generateSpecs(app, {
  excludeMethods: [method],
  defaultOptions: { QUERY: ok },
  documentation: {
    paths: { "/manual": { query: ok, post: { ...ok, callbacks: { result: callback } } } },
    webhooks: { incoming: { query: ok } },
    components: { pathItems: { Search: { query: ok } }, callbacks: { Search: callback } }
  }
});
const operationId: string | undefined = specs.paths["/search"]?.query?.operationId;
// Generation always supplies these fields, including with no documentation options.
const defaults = await generateSpecs(new Hono());
const description: string = defaults.info.description;
const schemas = defaults.components.schemas;
const legacy: OpenAPIV3_1.Document = defaults;
const item = specs.components?.pathItems?.Search;
if (item && !("$ref" in item)) {
  const operationId: string | undefined = item.query?.operationId;
}
const webhook = specs.webhooks?.incoming;
if (webhook && !("$ref" in webhook)) {
  const operationId: string | undefined = webhook.query?.operationId;
}
}
`;
      await writeFile(join(consumerDirectory, "query.ts"), consumerSource);
      await writeFile(join(consumerDirectory, "query.cts"), consumerSource);
      await execFileAsync(
        process.execPath,
        [
          join(projectRoot, "node_modules/typescript/bin/tsc"),
          "--noEmit",
          "--strict",
          "--skipLibCheck",
          "--module",
          "NodeNext",
          "--moduleResolution",
          "NodeNext",
          "--target",
          "ES2022",
          "query.ts",
          "query.cts",
        ],
        { cwd: consumerDirectory },
      ).catch((error) => {
        throw new Error(error.stdout || error.message, { cause: error });
      });
    } finally {
      await rm(tempDirectory, { force: true, recursive: true });
    }
  });
});
