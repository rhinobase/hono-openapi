const { withNx } = require("@nx/rollup/with-nx");
const terser = require("@rollup/plugin-terser");
const copy = require("rollup-plugin-copy");

const config = withNx(
  {
    main: "./src/index.ts",
    outputPath: "./dist",
    tsConfig: "./tsconfig.lib.json",
    compiler: "swc",
    format: ["cjs", "esm"],
    assets: [{ input: ".", output: ".", glob: "README.md" }],
  },
  {
    input: {
      index: "./src/index.ts",
      zod: "./src/zod.ts",
      valibot: "./src/valibot.ts",
      typebox: "./src/typebox.ts",
      arktype: "./src/arktype.ts",
      effect: "./src/effect.ts",
    },
    plugins: [
      copy({
        hook: "writeBundle",
        targets: [
          {
            src: ["./dist/*.d.ts"],
            dest: "./dist",
            rename: (name, extension) => `${name}.c${extension}`,
          },
          {
            src: ["./dist/*.d.ts"],
            dest: "./dist",
            transform: (contents, filename) =>
              contents
                .toString()
                .replace(
                  /export \* from "(\.\/src\/[a-z]+)";/g,
                  'export * from "$1.js";',
                ),
          },
        ],
      }),
      terser(),
    ],
  },
);

config.output = config.output.map((output) => {
  const ext = output.format === "cjs" ? "cjs" : "js";
  output.entryFileNames = `[name].${ext}`;
  output.chunkFileNames = `[name].${ext}`;
  return output;
});

module.exports = config;
