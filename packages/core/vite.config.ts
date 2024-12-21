/// <reference types='vitest' />
import { defineConfig } from "vite";

import { nxCopyAssetsPlugin } from "@nx/vite/plugins/nx-copy-assets.plugin";
import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin";

export default defineConfig({
  root: __dirname,
  cacheDir: "../../node_modules/.vite/packages/core",
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(["*.md"])],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  test: {
    watch: false,
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    reporters: ["default"],
    coverage: {
      reportsDirectory: "../../coverage/packages/core",
      provider: "v8",
    },
  },
});
