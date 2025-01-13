import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";
import copy from "rollup-plugin-copy";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  input: {
    index: "./packages/core/src/index.ts",
    zod: "./packages/core/src/zod.ts",
    valibot: "./packages/core/src/valibot.ts",
    typebox: "./packages/core/src/typebox.ts",
    arktype: "./packages/core/src/arktype.ts",
    effect: "./packages/core/src/effect.ts",
  },
  output: [
    {
      dir: "./packages/core/dist",
      format: "esm",
    },
    {
      dir: "./packages/core/dist",
      format: "cjs",
      entryFileNames: "[name].cjs",
    },
  ],
  external: Object.keys(pkg.optionalDependencies),
  plugins: [
    typescript({
      tsconfig: "./packages/core/tsconfig.lib.json",
    }),
    terser(),
    copy({
      targets: [
        {
          src: ["./README.md", "./packages/core/package.json"],
          dest: "./packages/core/dist",
        },
      ],
    }),
  ],
});
