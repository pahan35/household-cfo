# Spec Delta

## MODIFIED Requirements

### Requirement: Configurable ExternalProvider adapter mode with live default
The system SHALL resolve the active ExternalProvider upstream adapter from the `EXTERNAL_API_ADAPTER` environment variable (`"external-provider"` or `"mock"`), defaulting to `"external-provider"` when `EXTERNAL_API_ADAPTER` is unset or empty. When `EXTERNAL_API_ADAPTER` is set to `"mock"`, the server MUST NOT issue any HTTP requests to `https://api.external-provider.example.com` or resolve ExternalProvider upstream credentials (`EXTERNAL_API_WEB_COOKIE`, `EXTERNAL_API_TOKEN`, or macOS Keychain items). Furthermore, whenever deployed on the Vercel E2E branch (`VERCEL_GIT_COMMIT_REF="e2e"`), the system MUST enforce `EXTERNAL_API_ADAPTER="mock"` and disallow live mode.

#### Scenario: Default mode uses live ExternalProvider upstream
- **WHEN** `EXTERNAL_API_ADAPTER` is unset or set to `"external-provider"` and not running on the E2E deployment branch
- **THEN** the server uses the live ExternalProvider adapter to communicate with `https://api.external-provider.example.com` and resolves upstream credentials via the configured `EXTERNAL_API_SECRET_SOURCE`

#### Scenario: Mock mode operates without upstream network calls or credentials
- **WHEN** `EXTERNAL_API_ADAPTER` is set to `"mock"`
- **THEN** all proxy, synchronization, and `/api/v1/external-provider/*` operations execute exclusively against the server persistence store without contacting `https://api.external-provider.example.com` or requiring ExternalProvider credentials

#### Scenario: Invalid adapter configuration fails closed
- **WHEN** `EXTERNAL_API_ADAPTER` is set to a value other than `"external-provider"` or `"mock"`
- **THEN** the server rejects the operation with a configuration error (`503` / `ServiceError`) describing the valid `EXTERNAL_API_ADAPTER` values

#### Scenario: E2E branch deployment mandates mock adapter
- **WHEN** `VERCEL_GIT_COMMIT_REF` is set to `"e2e"` and `EXTERNAL_API_ADAPTER` is not `"mock"`
- **THEN** validation fails immediately at build and boot time with a critical security error

### Requirement: Hard-isolated mock Supabase credential resolution across all domain stores
When `EXTERNAL_API_ADAPTER` is set to `"mock"`, all server domain stores (`externalProvider`, `offers`, `runway`, `mortgage`, `time-value`, and `presets`) SHALL resolve their Supabase connection exclusively from `SUPABASE_MOCK_URL` and `SUPABASE_MOCK_SECRET_KEY` (or `SUPABASE_MOCK_SERVICE_ROLE_KEY`) and MUST NOT read `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, or `SUPABASE_SERVICE_ROLE_KEY`. When `SUPABASE_MOCK_URL` is not configured in mock mode, stores SHALL fall back to an isolated local mock file or in-memory store separate from the live local cache file. Additionally, `SUPABASE_MOCK_URL` MUST NOT match `SUPABASE_URL`.

#### Scenario: Mock mode connects exclusively to mock Supabase project
- **WHEN** `EXTERNAL_API_ADAPTER` is `"mock"` and distinct mock (`SUPABASE_MOCK_URL`, `SUPABASE_MOCK_SECRET_KEY`) variables are configured
- **THEN** all domain stores connect to `SUPABASE_MOCK_URL` using `SUPABASE_MOCK_SECRET_KEY` and never read or mutate the production `SUPABASE_URL` project

#### Scenario: Mock mode without mock Supabase credentials falls back to isolated local store
- **WHEN** `EXTERNAL_API_ADAPTER` is `"mock"`, `SUPABASE_MOCK_URL` is unset, and `SUPABASE_URL` is set
- **THEN** the server falls back to local mock persistence (`.cache/external-provider-mock-store.json` / in-memory stores) and MUST NOT connect to `SUPABASE_URL`

#### Scenario: Rejecting accidental database URL collision
- **WHEN** `EXTERNAL_API_ADAPTER` is `"mock"` and `SUPABASE_MOCK_URL` is identical to `SUPABASE_URL`
- **THEN** validation fails immediately with a fatal configuration error preventing startup or mutation of production data
