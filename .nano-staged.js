export default {
    "./src/**/*.{js,ts}": (api) =>
        `pnpm dlx @biomejs/biome check --write ${api.filenames.join(" ")}`,
};
