module.exports = {
  "{apps,packages,tools}/**/*.{js,jsx,ts,tsx,json}": (api) =>
    `pnpm dlx @biomejs/biome check --write ${api.filenames.join(" ")}`,
};
