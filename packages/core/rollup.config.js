const { withNx } = require("@nx/rollup/with-nx");
const terser = require("@rollup/plugin-terser");
const pkg = require("./package.json");

module.exports = withNx(
  {
    main: "./src/index.ts",
    outputPath: "./dist",
    tsConfig: "./tsconfig.lib.json",
    compiler: "swc",
    format: ["cjs", "esm"],
    assets: [{ input: ".", output: ".", glob: "README.md" }],
    external: pkg.optionalDependencies
      ? Object.keys(pkg.optionalDependencies)
      : [],
  },
  {
    input: {
      index: "./src/index.ts",
      zod: "./src/zod.ts",
      valibot: "./src/valibot.ts",
      typebox: "./src/typebox.ts",
      arktype: "./src/arktype.ts",
    },
    // plugins: [terser()],
  }
);
