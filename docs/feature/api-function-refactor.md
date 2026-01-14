# Feature Spec: API Function Refactor

## Feature Summary
- Problem / why now: Azure Functions backend has inconsistent request parsing, validation, error handling, and data-access patterns, which slows delivery and increases risk of regressions when new endpoints are added.
- Primary users: Backend developers working on `api/` Azure Functions.
- Desired outcome: A refactor-only cleanup that standardizes helpers and reduces duplication while keeping external API behavior unchanged.

## Rollout / Scope
- MVP in scope: Refactor existing functions under `api/src/functions` to reuse shared helpers, unify error handling, and reduce duplication.
- MVP in scope: Preserve current external behavior (status codes, response shapes, auth requirements).
- Out of scope: New API endpoints, schema changes, or user-facing functionality changes.
- Success criteria: For all existing endpoints, responses for the same inputs remain identical in status code, response shape, and auth requirements.

## User Stories
1. As a developer, I want consistent validation and error responses so I can add or modify endpoints without re-creating error patterns.
2. As a developer, I want shared request parsing and auth verification helpers so handlers remain small and readable.
3. As a developer, I want shared Cosmos data-access helpers so similar queries are not reimplemented in multiple functions.
4. As a developer, I want Cosmos clients/containers reused across requests so local development is faster and logs are quieter.

## User Story Details
### 1) Consistent validation and errors
**User story**  
As a developer, I want consistent validation and error responses so I can add or modify endpoints without re-creating error patterns.

**Important data flows and validations**
- JSON request parsing errors are returned as validation errors.
- Input validation yields a standard problem+json error response with a consistent shape across endpoints.

**Acceptance criteria**
- All current endpoints return validation errors in a single, consistent format.
- Validation error format includes a stable top-level shape and an array of field-level issues with stable ids and messages.
- Non-validation errors continue to surface as structured errors with appropriate status codes.
- No endpoint-specific validation error variants remain.

**UX notes**
- API consumers see consistent error shapes across endpoints; no new fields are required to parse errors.

### 2) Shared request parsing and auth
**User story**  
As a developer, I want shared request parsing and auth verification helpers so handlers remain small and readable.

**Important data flows and validations**
- Auth logic is reused across authenticated endpoints.
- JSON parsing helpers provide typed parsing with standard error responses.

**Acceptance criteria**
- All authenticated endpoints use a shared auth helper and the same verification flow.
- JSON parsing errors are handled by a shared helper instead of per-endpoint try/catch.
- Each function handler focuses on routing and calling a service/data helper.
- Unauthorized responses use a consistent error shape across authenticated endpoints.
 - Each HTTP handler declares a clear HTTP method and URI path mapping in code (one method/path per handler).

**UX notes**
- No changes to auth behavior or tokens returned to clients.

### 3) Shared Cosmos data access
**User story**  
As a developer, I want shared Cosmos data-access helpers so similar queries are not reimplemented in multiple functions.

**Important data flows and validations**
- Reads and writes to participants, incidents, and user links use shared data-access helpers with the same query semantics as before.

**Acceptance criteria**
- Queries duplicated across functions (for example, participant link lookup, incident reads) exist in a shared module.
- All functions call the shared module with the same parameters as before.
- Query behavior, sorting, and pagination tokens remain unchanged.

**UX notes**
- No user-facing changes; API responses and pagination tokens are unchanged.

### 4) Reuse Cosmos clients/containers
**User story**  
As a developer, I want Cosmos clients/containers reused across requests so local development is faster and logs are quieter.

**Important data flows and validations**
- The Cosmos client and container map are initialized once and reused for subsequent requests within the same function host.

**Acceptance criteria**
- Cosmos client/container creation is cached at module scope.
- Behavior matches current initialization (same database and container names) without changing output paths.
- If environment variables change, the host must be restarted to pick up new config (documented).
 - Local dev logs show reduced repeated Cosmos client initialization.

**UX notes**
- No user-facing changes; reduced cold-start latency for developers.

## Open Questions
- Should we standardize on problem+json for all errors, or keep the current mix for non-validation errors?
- Are any endpoints intentionally allowed to keep a non-problem+json error shape for backwards compatibility?
- Do we want to introduce a shared service-layer folder for business logic, or keep helpers in shared/data only?
- Is there any endpoint that intentionally diverges from the standard error shape or auth flow?

## Technical Considerations
- This is a refactor-only feature; changes should be limited to shared helpers and function wiring.
- Keep timestamps in UTC and avoid altering any time-related logic.
