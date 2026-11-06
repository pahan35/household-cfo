# Spec Delta

## Purpose

Prevents search engines, web crawlers, and AI training/search bots from indexing, archiving, following links, or enumerating routes across the family budget application.

## ADDED Requirements

### Requirement: Blanket robots.txt disallow for all crawlers and AI bots
The system SHALL serve a `/robots.txt` response that disallows crawling of all paths (`Disallow: /`) for all user-agents (`User-Agent: *`) as well as explicitly named search and AI crawlers, and MUST set `Content-Signal: ai-train=no, search=no, ai-input=no` with no `Sitemap:` directive.

#### Scenario: Standard search crawler requests robots.txt
- **WHEN** any web crawler requests `GET /robots.txt`
- **THEN** the response body includes `User-Agent: *` followed by `Disallow: /` and omits any `Allow: /` or `Sitemap:` lines

#### Scenario: AI training or search bot requests robots.txt
- **WHEN** an AI crawler (such as `GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `Claude-SearchBot`, `Google-Extended`, `CCBot`, or `Bytespider`) inspects `/robots.txt`
- **THEN** the response explicitly disallows `/` and declares `Content-Signal: ai-train=no, search=no, ai-input=no`

### Requirement: No public sitemap route enumeration
The system SHALL NOT expose a public `/sitemap.xml` listing application routes.

#### Scenario: Requesting sitemap.xml
- **WHEN** a client or bot requests `GET /sitemap.xml`
- **THEN** no internal dashboard or authentication URLs are enumerated

### Requirement: Global HTML robots meta directives
The root application layout SHALL emit `<meta name="robots">` and `<meta name="googlebot">` tags instructing crawlers not to index pages, not to follow links, not to cache snapshots, and not to index images.

#### Scenario: Rendering any HTML page
- **WHEN** any page under the root layout is rendered
- **THEN** the HTML `<head>` includes `noindex, nofollow, nocache` directives for `robots` and `noindex, nofollow, noimageindex, noarchive, nosnippet` directives for `googlebot`

### Requirement: Global X-Robots-Tag HTTP response header
The server SHALL attach an `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` HTTP header to all responses so non-HTML resources (including API endpoints and static assets) are also excluded from indexing.

#### Scenario: Requesting any page or API route
- **WHEN** a client or crawler requests any path matching `/:path*`
- **THEN** the HTTP response headers include `X-Robots-Tag` containing `noindex, nofollow, noarchive, nosnippet, noimageindex`
