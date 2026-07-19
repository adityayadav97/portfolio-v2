import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { test } from "node:test";

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const assetFiles = await readdir(new URL("../dist/_astro/", import.meta.url));
const cssFiles = assetFiles.filter((file) => file.endsWith(".css"));
const jsFiles = assetFiles.filter((file) => file.endsWith(".js"));
const css = (
  await Promise.all(
    cssFiles.map((file) => readFile(new URL(`../dist/_astro/${file}`, import.meta.url), "utf8")),
  )
).join("\n");
const js = (
  await Promise.all(
    jsFiles.map((file) => readFile(new URL(`../dist/_astro/${file}`, import.meta.url), "utf8")),
  )
).join("\n");

test("build has canonical metadata and semantic landmarks", () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/adityayadav97\.github\.io\/"/);
  assert.match(html, /<main id="main-content">/);
  assert.match(html, /<nav[^>]+aria-label="Primary navigation"/);
  assert.match(html, /application\/ld\+json/);
});

test("GitHub Pages asset paths include the project base", () => {
  assert.match(html, /\/portfolio-v2\/_astro\//);
  assert.doesNotMatch(html, /(?:src|href)="\/_astro\//);
});

test("social sharing metadata ships with its visual", async () => {
  assert.match(html, /property="og:image" content="https:\/\/adityayadav97\.github\.io\/og\.jpg"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);

  const socialImage = await stat(new URL("../dist/og.jpg", import.meta.url));
  assert.ok(socialImage.size > 100_000);
  assert.ok(socialImage.size < 250_000);
});

test("recruiter assets and discovery files are self-hosted", async () => {
  assert.match(html, /href="\/portfolio-v2\/Aditya-Yadav-Data-Engineer-Resume\.pdf"/);
  assert.match(html, /src="\/portfolio-v2\/aditya-yadav\.jpg"/);

  const resume = await stat(
    new URL("../dist/Aditya-Yadav-Data-Engineer-Resume.pdf", import.meta.url),
  );
  const portrait = await stat(new URL("../dist/aditya-yadav.jpg", import.meta.url));
  const robots = await readFile(new URL("../dist/robots.txt", import.meta.url), "utf8");
  const sitemap = await readFile(new URL("../dist/sitemap.xml", import.meta.url), "utf8");

  assert.ok(resume.size > 100_000);
  assert.ok(portrait.size > 10_000);
  assert.match(robots, /Sitemap: https:\/\/adityayadav97\.github\.io\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/adityayadav97\.github\.io\/<\/loc>/);
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
  assert.match(html, /href="#contact" aria-label="Let's talk: jump to contact options"/);
  assert.match(html, /data-scroll-label="Contact"/);
  assert.match(html, /href="mailto:adityayadav8g@gmail\.com\?subject=Data%20engineering%20opportunity"/);
  assert.match(html, /https:\/\/mail\.google\.com\/mail\/\?view=cm&amp;fs=1&amp;to=adityayadav8g@gmail\.com/);
  assert.match(html, /aria-label="Compose in Gmail to adityayadav8g@gmail\.com \(opens in a new tab\)"/);
  assert.match(html, /data-copy-email/);
  assert.match(html, /data-mobile-resume/);
  assert.match(html, /class="nav-resume"/);
  assert.match(html, />View resume</);
  assert.match(html, /download="Aditya-Yadav-Data-Engineer-Resume\.pdf"/);
  const externalActions = [...html.matchAll(/<a[^>]*data-external-action[^>]*>/g)].map(
    ([tag]) => tag,
  );
  assert.equal(externalActions.length, 7);
  externalActions.forEach((tag) => {
    assert.match(tag, /target="_blank"/);
    assert.match(tag, /rel="noopener noreferrer"/);
  });
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /data-section="contact"/);
  assert.match(html, /aria-labelledby="impact-label"/);
});

test("premium scroll hooks and experience hierarchy ship in production", () => {
  assert.match(html, /class="scroll-monitor"/);
  assert.match(js, /style\.transform=`scaleX\(\$\{/);
  assert.match(html, /data-experience-row/);
  assert.match(html, /data-motion-kind="experience"/);
  assert.match(css, /\.experience-row\.is-experience-active/);
  assert.match(css, /--section-progress/);
  assert.match(html, /data-portrait/);
  assert.doesNotMatch(html, /portrait-scan/);
  assert.match(css, /--portrait-gray/);
  assert.doesNotMatch(css, /\.portrait-scan/);
  assert.match(js, /portraitPhase/);
  assert.match(css, /telemetry-scan/);
});

test("featured project and cinematic interaction hooks ship in production", () => {
  const orderedProjectIds = ["benchbuddy", "lakehouse", "streaming", "dashboard"];
  const projectPositions = orderedProjectIds.map((id) => html.indexOf(`id="${id}"`));
  assert.ok(projectPositions.every((position) => position >= 0));
  assert.deepEqual(projectPositions, [...projectPositions].sort((a, b) => a - b));
  orderedProjectIds.forEach((_, index) => {
    const sectionMarkup = html.slice(projectPositions[index], projectPositions[index] + 700);
    assert.match(sectionMarkup, new RegExp(`data-project-index="0${index + 1}"`));
  });
  assert.match(html, /Live demo · Public access/);
  assert.match(html, /Try BenchBuddy AI/);
  assert.match(html, /https:\/\/benchbuddy\.streamlit\.app\/\?embed=true/);
  assert.match(html, /Review source &amp; tests/);
  assert.match(html, /class="assistant-retrieval"/);
  assert.match(html, /class="dashboard-playhead"/);
  assert.match(html, /data-ambient-field/);
  assert.match(html, /data-back-to-top/);
  assert.match(css, /\.ambient-data-field/);
  assert.match(css, /\.featured-project-badge/);
  assert.match(js, /--portrait-focus/);
  assert.match(js, /--project-line-dash/);
  assert.match(js, /back-progress-angle/);
});

test("dimensional visual system and compact systems layout ship in production", () => {
  assert.match(html, /class="hero-depth-hud"/);
  assert.match(html, /class="hero-wordmark"/);
  assert.match(html, /class="flow-runline"/);
  assert.match(html, /class="bloom-telemetry"/);
  assert.match(html, /class="bloom-depth-grid"/);
  assert.match(html, /class="about-console"/);
  assert.match(js, /ThreeDataFlowScene/);
  assert.match(js, /animatedLabels/);
  assert.match(js, /signalSweep/);
  assert.match(js, /sceneZone/);
  assert.match(js, /setScissor/);
  assert.match(js, /cloneNode/);
  assert.doesNotMatch(css, /min-height:130svh/);
  assert.match(css, /--electric-cyan/);
});

test("verified public project demos are published", () => {
  assert.doesNotMatch(html, /ADD_RETAIL_DASHBOARD_URL/);
  assert.match(html, /retail-analytics-dashboard/);
  assert.match(html, /Live analytics product/);
  assert.match(html, /https:\/\/retail-analytic-dashboard\.streamlit\.app\/\?embed=true/);
  assert.match(html, /Open live dashboard/);
  assert.match(html, /Review dashboard code &amp; setup/);
  assert.doesNotMatch(html, /not yet live|deploy-ready/i);
});

test("public claims remain precise and evidence-aligned", () => {
  assert.doesNotMatch(html, /Fortune 500 clients/i);
  assert.doesNotMatch(html, /event-to-insight/i);
  assert.doesNotMatch(html, /C5F971221032C906/);
  assert.match(html, /global enterprise clients/i);
  assert.match(html, /event-to-Delta/i);
  assert.match(html, /Selected client engagements delivered via EPAM/);
  assert.match(html, /Winner, EngX India, 2025/);
  assert.match(html, /SIMULATED/);
  assert.match(html, /Simulated throughput/);
});
