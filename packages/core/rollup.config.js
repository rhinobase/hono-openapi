const { withNx } = require("@nx/rollup/with-nx");

module.exports = withNx(
  {
    main: "./src/index.ts",
    outputPath: "./dist",
    tsConfig: "./tsconfig.lib.json",
    compiler: "swc",
    format: ["cjs", "esm"],
    assets: [{ input: ".", output: ".", glob: "README.md" }],
  },
  {
    input: ["./src/index.ts", "./src/zod.ts"],
  }
);
