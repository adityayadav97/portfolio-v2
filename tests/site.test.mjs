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
  assert.match(html, /id="trust-bloom" aria-hidden="true"/);
  assert.match(html, /aria-label="Pause motion"/);
  assert.match(html, /data-bloom-section/);
  assert.match(css, /body\.motion-paused/);
});

test("contact actions use browser-reliable destinations and controls", () => {
  assert.match(html, /href="#contact" aria-label="Open channel: jump to contact options"/);
  assert.match(html, /https:\/\/mail\.google\.com\/mail\/\?view=cm&amp;fs=1&amp;to=adityayadav8g@gmail\.com/);
  assert.match(html, /aria-label="Compose in Gmail to adityayadav8g@gmail\.com \(opens in a new tab\)"/);
  assert.match(html, /data-copy-email/);
  assert.match(html, /data-mobile-resume/);
  const externalActions = [...html.matchAll(/<a[^>]*data-external-action[^>]*>/g)].map(
    ([tag]) => tag,
  );
  assert.equal(externalActions.length, 6);
  externalActions.forEach((tag) => {
    assert.match(tag, /target="_blank"/);
    assert.match(tag, /rel="noopener noreferrer"/);
  });
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /data-section="contact"/);
  assert.match(html, /aria-labelledby="impact-label"/);
  assert.doesNotMatch(html, /href="mailto:adityayadav8g@gmail\.com"/);
});

test("premium scroll hooks and experience hierarchy ship in production", () => {
  assert.match(html, /class="scroll-monitor"/);
  assert.match(html, /data-experience-row/);
  assert.match(html, /data-motion-kind="experience"/);
  assert.match(css, /\.experience-row\.is-experience-active/);
  assert.match(css, /--section-progress/);
  assert.match(html, /data-portrait/);
  assert.match(css, /--portrait-gray/);
  assert.match(css, /telemetry-scan/);
});

test("the broken retail dashboard live link is not published", () => {
  assert.doesNotMatch(html, /ADD_RETAIL_DASHBOARD_URL/);
  assert.match(html, /retail-analytics-dashboard/);
});
