import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    typecheck: {
      enabled: true,
      // Scoped to the RPC type-inference regression test. A repo-wide
      // typecheck currently surfaces pre-existing strict-mode errors in the
      // OpenAPI generation code and other test files; widening this is a
      // separate cleanup.
      include: ["src/__tests__/rpc-types.test.ts"],
      tsconfig: "./tsconfig.typecheck.json",
    },
  },
});
