# Proposal (Draft)

## Why

When ExternalProvider web session secrets (`EXTERNAL_API_WEB_COOKIE` / `EXTERNAL_API_WEB_USER`) are missing or expire on Vercel, the family budget dashboard cannot fetch live upstream data until fresh credentials are placed into Vercel Environment Variables. We need automated email alerts (with deduplication/cooldown) that notify the allowed family emails and provide clear step-by-step instructions on where to obtain fresh ExternalProvider credentials and how to update them in Vercel.

## What Changes

- Implement an email notification provider (e.g., Resend API or SMTP configured via secret Vercel environment variables) wired to the missing/stale credential detection hook introduced in `external-provider-env-secrets`.
- Add a scheduled Vercel Cron health-check endpoint (`/api/health/externalProvider`, protected by `CRON_SECRET`) that proactively verifies ExternalProvider upstream session validity and triggers the email alert if credentials have expired even when no user is actively browsing.
- Include a self-contained remediation guide in the alert email body detailing:
  1. How and where to extract the fresh `Cookie` request header (`external-api-web-cookie`) and `window.USER.id` (`external-api-web-user`) from a logged-in `api.external-provider.example.com` browser session (plus optional local helper command to sync from macOS Keychain to Vercel CLI).
  2. Which exact Vercel Project Environment Variables (`EXTERNAL_API_WEB_COOKIE`, `EXTERNAL_API_WEB_USER`, `EXTERNAL_API_SECRET_SOURCE=env`) to update in the Vercel Dashboard.
  3. How to redeploy or trigger a fresh serverless invocation so the updated secrets take effect immediately.
- Add alert rate-limiting/deduplication so a burst of failed proxy requests does not spam the inbox.

## Capabilities

### New Capabilities
- `external-provider-stale-secret-email-alerts`: Automated email alerting and scheduled cron health checks for missing or stale ExternalProvider credentials, including actionable step-by-step renewal instructions for Vercel.

### Modified Capabilities
<!-- None -->

## Impact

- `src/server/external-provider/alerts.ts` (email dispatcher, cooldown state, remediation email template)
- `src/app/api/health/externalProvider/route.ts` (authenticated cron/health check endpoint)
- `vercel.json` (Vercel Cron schedule configuration)
- `docs/externalProvider/` (credential renewal runbook)
- `.env.example`
