# Tasks

## 1. Robots & Sitemap Hardening

- [ ] 1.1 Update `src/app/robots.txt` to set `Disallow: /` and `Content-Signal: ai-train=no, search=no, ai-input=no` for `*` and all named search/AI bots, and remove the `Sitemap:` line; verify by inspecting `src/app/robots.txt` for zero `Allow:` or `Sitemap:` directives.
- [ ] 1.2 Remove `src/app/sitemap.ts` so no routes are publicly enumerated; verify that `src/app/sitemap.ts` no longer exists in the workspace.

## 2. Metadata & HTTP Header Enforcement

- [ ] 2.1 Update `metadata` in `src/app/layout.tsx` to include `robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true, noarchive: true, nosnippet: true } }`; verify with `npm run verify`.
- [ ] 2.2 Add `async headers()` to `next.config.mjs` returning `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` on `source: "/:path*"`; verify with `npm run verify` and unit/config tests.
