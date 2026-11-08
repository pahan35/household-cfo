# Spec Delta

## MODIFIED Requirements

### Requirement: Versioned REST endpoints for mobile and external integrations
The system SHALL expose versioned REST endpoints under `/api/v1/` to support external callers, automation daemons, E2E test runners, and mobile companion applications, including ExternalProvider domain endpoints (`/api/v1/external-provider/snapshot`, `/api/v1/external-provider/sync`, `/api/v1/external-provider/transactions`, `/api/v1/external-provider/categories`, and mock-only `/api/v1/external-provider/mock/reset`). These endpoints SHALL support Bearer token or API key authentication in addition to web session cookies and SHALL delegate all domain logic to `src/server/services/`.

#### Scenario: Ingesting data from mobile application or automation
- **WHEN** an external companion or mobile app sends a POST request to `/api/v1/...` with a valid Bearer token and JSON body
- **THEN** the endpoint validates the token, delegates to the corresponding domain service, and returns standard HTTP status codes and JSON payloads

#### Scenario: Creating or updating ExternalProvider transactions and categories via versioned REST API
- **WHEN** an authenticated mobile client or E2E harness sends a request to `/api/v1/external-provider/transactions` or `/api/v1/external-provider/categories` with a valid Zod-validated payload
- **THEN** the endpoint delegates to `external-provider-service`, executes against the active `ExternalProviderUpstreamAdapter` (`"external-provider"` or `"mock"`), and returns the updated entity or snapshot state
