# env-validation-and-safety-guards Specification

## Purpose
Provides centralized, type-safe environment variable parsing with cross-variable safety assertions and build-time verification to prevent production data corruption and configuration errors.

## Requirements

### Requirement: Centralized server environment schema validation
The system SHALL validate all server-side environment variables through a centralized Zod schema at application boot and during production builds. Invalid configurations MUST produce descriptive, actionable validation errors highlighting the offending variables and halt execution immediately.

#### Scenario: Valid environment boot
- **WHEN** all required server environment variables are present and meet schema constraints
- **THEN** the schema validation succeeds and exposes a typed environment configuration object

#### Scenario: Missing or malformed environment in production
- **WHEN** the server boots or builds in production mode (`NODE_ENV="production"` or `VERCEL_ENV="production"`) without a required `AUTH_SECRET` or with an invalid URL
- **THEN** validation fails immediately with a descriptive error listing the missing or invalid keys and execution is halted

### Requirement: Test-isolated environment parsing
The system SHALL export a pure, side-effect-free validation function that accepts a custom environment record. This function MUST allow tests to evaluate arbitrary configuration scenarios without modifying or relying on global `process.env`.

#### Scenario: Unit tests validate custom environment dictionaries
- **WHEN** a test calls the environment validator with an isolated dictionary of variables
- **THEN** the validator returns parsed and validated values or throws structured validation errors without mutating the global environment

### Requirement: Safe client environment variable exposure
The system SHALL validate client-side `NEXT_PUBLIC_*` variables separately from server variables. Server secrets MUST NEVER be included in the client schema or bundled into the client runtime.

#### Scenario: Client environment validation
- **WHEN** the client environment schema is parsed
- **THEN** only allowlisted `NEXT_PUBLIC_*` properties (such as `NEXT_PUBLIC_APP_MODE`) are validated and exposed
