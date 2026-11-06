# Proposal

## Why

Deploying the family budget dashboard to Vercel makes it reachable on a public URL, whereas the upstream template defaults (`src/app/robots.txt`, `src/app/sitemap.ts`, and `src/app/layout.tsx`) explicitly invite search engines and AI training crawlers to index all pages. Before exposing the application on the internet, we must enforce strict defense-in-depth crawler disallow and `noindex` rules across robots.txt, HTML metadata, and HTTP response headers.

## What Changes

- Replace the permissive `src/app/robots.txt` rules (`Allow: /`, `Content-Signal: ai-train=yes, search=yes, ai-input=yes`, and `Sitemap:` pointer) with blanket disallow rules (`Disallow: /` and `Content-Signal: ai-train=no, search=no, ai-input=no`) for `*` and all known search/AI user-agents.
- Remove `src/app/sitemap.ts` (or return an empty sitemap) so internal routes are never enumerated for crawlers.
- Add global `robots` metadata (`index: false`, `follow: false`, `nocache: true`, and equivalent `googleBot` directives including `noimageindex: true`) in `src/app/layout.tsx`.
- Configure a global HTTP response header `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` on `/:path*` in `next.config.mjs` so API routes, static assets, and non-HTML responses are also protected from indexing.

## Capabilities

### New Capabilities
- `crawler-and-indexing-protection`: Multi-layer bot disallow and `noindex`/`nofollow` enforcement via `robots.txt`, Next.js root metadata, `X-Robots-Tag` HTTP headers, and removal of public sitemap enumeration.

### Modified Capabilities
<!-- None -->

## Impact

- `src/app/robots.txt`
- `src/app/sitemap.ts` (removed)
- `src/app/layout.tsx`
- `next.config.mjs`
