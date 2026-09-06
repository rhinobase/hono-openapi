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

describe("package installation", () => {
  it("imports after a consumer installs it without auto-installed peers", async () => {
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
          "import('hono-openapi').then(({ generateSpecs }) => { if (!generateSpecs) process.exit(1) })",
        ],
        { cwd: consumerDirectory },
      );

      expect(stderr).toBe("");
    } finally {
      await rm(tempDirectory, { force: true, recursive: true });
    }
  });
});
