import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://adityayadav97.github.io",
  base: process.env.PORTFOLIO_BASE ?? "/portfolio-v2",
  output: "static",
  trailingSlash: "always",
});
