# Design

## Context

See `proposal.md` for motivation. The upstream admin template ships with SEO-friendly defaults (`src/app/robots.txt` allowing `/` and AI training, `src/app/sitemap.ts` enumerating 27 routes, and `src/app/layout.tsx` lacking `robots` restrictions). Because this repository powers a private family budget dashboard deployed to Vercel, every layer must instruct crawlers not to index or archive any route or asset.

## Goals / Non-Goals

**Goals:**
- Enforce `Disallow: /` and `Content-Signal: ai-train=no, search=no, ai-input=no` in `src/app/robots.txt`.
- Eliminate route enumeration via `src/app/sitemap.ts`.
- Add root Next.js `Metadata["robots"]` directives in `src/app/layout.tsx`.
- Emit `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` across all routes via `next.config.mjs` `headers()`.

**Non-Goals:**
- User authentication and session enforcement (covered in `google-oauth-family-allowlist`).

## Decisions

1. **Three-layer defense (`robots.txt` + `<meta name="robots">` + `X-Robots-Tag` HTTP header)**
   - *Rationale*: Well-behaved crawlers stop at `robots.txt` before making page requests. However, if a URL is linked externally, search engines may still index the URL unless the response itself carries `noindex` via `<meta>` or `X-Robots-Tag`. Furthermore, when `google-oauth-family-allowlist` redirects unauthenticated requests to `/auth/login`, the HTTP header ensures neither the redirect nor the login page nor any `/api/*` endpoint is indexed.
2. **Delete `src/app/sitemap.ts` and remove `Sitemap:` from `src/app/robots.txt`**
   - *Rationale*: A private application for two people has zero public pages that belong in a sitemap. Removing `src/app/sitemap.ts` prevents route discovery.

## Risks / Trade-offs

- **Risk**: Strictly blocking `/` in `robots.txt` prevents crawlers from seeing `<meta name="robots" content="noindex">` if they never fetch the page.
  → **Mitigation**: Including `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` on every HTTP response (including `/robots.txt` and `/auth/login`) and removing `sitemap.xml` ensures crawlers neither discover internal URLs nor index any response they do fetch.
