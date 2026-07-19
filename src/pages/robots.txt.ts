import type { APIRoute } from "astro";

export const prerender = true;

const canonical = new URL(
  import.meta.env.BASE_URL,
  "https://adityayadav97.github.io",
).toString();

export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\nSitemap: ${canonical}sitemap.xml\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
