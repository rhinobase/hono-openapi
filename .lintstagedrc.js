module.exports = {
  "{apps,packages,tools}/**/*.{js,jsx,ts,tsx,json}": [
    (files) => `pnpm dlx @biomejs/biome check --write ${files.join(" ")}`,
  ],
};
