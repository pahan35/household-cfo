# Design

## Context

See `proposal.md` for motivation. Today `src/server/external-provider/token.ts` only reads `external-api-web-cookie` and `external-api-web-user` from the macOS Keychain via `security find-generic-password`. On Vercel (Linux serverless runtime), the macOS `security` binary does not exist, and credentials must be supplied via encrypted Vercel Environment Variables while keeping the local macOS Keychain workflow untouched by default.

## Goals / Non-Goals

**Goals:**
- Introduce `EXTERNAL_API_SECRET_SOURCE` (`"keychain"` | `"env"`, defaulting to `"keychain"`).
- Support `EXTERNAL_API_WEB_COOKIE`, `EXTERNAL_API_WEB_USER`, and `EXTERNAL_API_TOKEN` in `"env"` mode without invoking `security`.
- Detect both missing (`503`) and stale/expired (`401`, `403`, redirect, HTML login payload) upstream credentials and invoke a rate-limited/pluggable alert notifier hook.
- Preserve all secret-handling guardrails in `.agents/rules/secrets.md` (no `NEXT_PUBLIC_` variables, full redaction via `scrubSecrets`).

**Non-Goals:**
- Full email provider delivery and step-by-step renewal runbook authoring (captured in the follow-up `external-provider-stale-secret-email-alerts` change, which plugs into the alert hook defined here).

## Decisions

1. **Explicit `EXTERNAL_API_SECRET_SOURCE` toggle defaulting to `"keychain"`**
   - *Rationale*: Implicit fallback chains (e.g., always trying Keychain first and falling back to `.env`, or vice versa) can mask stale `.env.local` values during local development or incur unnecessary child-process timeouts on Linux. An explicit control variable (`EXTERNAL_API_SECRET_SOURCE="keychain"` by default, `"env"` on Vercel) makes the credential source deterministic and self-documenting.
   - *Alternatives considered*: Auto-detecting `process.platform === "darwin"`. Rejected because the user requested an explicit env variable control that defaults to current behavior and switches to reading from env variables when changed, allowing local testing of `"env"` mode if desired.

2. **Staleness Detection Criteria in the ExternalProvider Proxy**
   - *Rationale*: ExternalProvider's web backend (`https://api.external-provider.example.com`) uses ASP.NET cookie authentication. When `external-api-web-cookie` expires:
     1. Some endpoints return HTTP `401` or `403`.
     2. Other endpoints return HTTP `302 Found` redirecting to `/auth` or `/login` (which causes `fetch(..., { redirect: "error" })` to throw a redirect error) or return `200 OK` with `content-type: text/html` login markup when `accept: application/json` was requested.
   - Detecting all three conditions allows `src/app/api/external-provider/[...path]/route.ts` to classify the failure as `stale_credentials`, evict the cached credential state, and invoke `notifyCredentialIssue({ reason: "stale" | "missing", source, upstreamPath, status })`.

## Risks / Trade-offs

- **Risk**: Large cookie strings in Vercel Environment Variables may contain leading/trailing whitespace or quotes when pasted into the Vercel dashboard.
  → **Mitigation**: Normalize `EXTERNAL_API_WEB_COOKIE` and `EXTERNAL_API_WEB_USER` by trimming whitespace and stripping accidental wrapping quotes (`"..."` or `'...'`) and leading `Cookie:` prefix if pasted verbatim from browser DevTools.
