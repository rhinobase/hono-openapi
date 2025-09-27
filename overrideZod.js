import { rename } from "node:fs/promises";
import { execSync } from "node:child_process";

try {
  await rename('pnpm-workspace.disabled', 'pnpm-workspace.yaml');
} catch {
  await rename('pnpm-workspace.yaml', 'pnpm-workspace.disabled');
}

execSync('pnpm i');
