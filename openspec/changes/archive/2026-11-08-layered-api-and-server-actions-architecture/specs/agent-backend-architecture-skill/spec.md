# Spec Delta

## Purpose

Enforces backend architecture conventions across all automated and human agent workflows, ensuring domain logic remains decoupled from transports and follows modern React/Next.js best practices.

## ADDED Requirements

### Requirement: Agentic harness architecture skill and rules
The repository SHALL provide an agent skill (`.agents/skills/backend-architecture/SKILL.md`) and project rule (`.agents/rules/api-architecture.md`) defining the layered service architecture, Server Action guidelines, and REST API conventions. All coding agents SHALL adhere to these constraints when implementing new features or refactoring backend routes.

#### Scenario: Agent scaffolding a new mutation or domain entity
- **WHEN** an agent is tasked with adding a new database mutation or feature workflow
- **THEN** the agent writes the business logic inside `src/server/services/`, exposes web mutations via `next-safe-action`, and keeps route handlers strictly as thin controllers

#### Scenario: Agent adding a mobile or external integration endpoint
- **WHEN** an agent is tasked with adding an endpoint for mobile apps or external sync
- **THEN** the agent places the route under `/api/v1/`, verifies Bearer token / API key authentication, and delegates to the shared domain service without duplicating business logic
