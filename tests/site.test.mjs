import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { test } from "node:test";

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const assetFiles = await readdir(new URL("../dist/_astro/", import.meta.url));
const cssFiles = assetFiles.filter((file) => file.endsWith(".css"));
const css = (
  await Promise.all(
    cssFiles.map((file) => readFile(new URL(`../dist/_astro/${file}`, import.meta.url), "utf8")),
  )
).join("\n");

test("build has canonical metadata and semantic landmarks", () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/adityayadav97\.github\.io\/portfolio-v2\/"/);
  assert.match(html, /<main id="main-content">/);
  assert.match(html, /<nav[^>]+aria-label="Primary navigation"/);
  assert.match(html, /application\/ld\+json/);
});

test("GitHub Pages asset paths include the project base", () => {
  assert.match(html, /\/portfolio-v2\/_astro\//);
  assert.doesNotMatch(html, /(?:src|href)="\/_astro\//);
});

test("social sharing metadata ships with its visual", async () => {
  assert.match(html, /property="og:image" content="https:\/\/adityayadav97\.github\.io\/portfolio-v2\/og\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);

  const socialImage = await stat(new URL("../dist/og.png", import.meta.url));
  assert.ok(socialImage.size > 100_000);
});

test("production output contains no known placeholders", () => {
  assert.doesNotMatch(html, /ADD_[A-Z_]+|YOUR_[A-Z_]+|example\.com|TODO/i);
  assert.doesNotMatch(html, /ADD-YOUR-STREAMLIT-URL-HERE/i);
});

test("motion and mobile navigation have accessible fallbacks", () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(html, /aria-controls="mobile-navigation"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /id="data-flow" aria-hidden="true"/);
});

test("the broken retail dashboard live link is not published", () => {
  assert.doesNotMatch(html, /ADD_RETAIL_DASHBOARD_URL/);
  assert.match(html, /retail-analytics-dashboard/);
});
