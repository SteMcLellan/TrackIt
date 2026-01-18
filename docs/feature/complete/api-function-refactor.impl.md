# Implementation Plan: API Function Refactor

## Scope Recap
- Refactor existing Azure Functions under `api/src/functions` to reuse shared helpers, unify error handling, and reduce duplication.
- Preserve current external behavior (status codes, response shapes, auth requirements) while standardizing internal patterns.
- No new endpoints, schema changes, or user-facing functionality changes.

## Assumptions / Open Questions
- Decision needed: standardize on `application/problem+json` for all errors vs validation-only (and whether any endpoints are exempt for backwards compatibility).
- Decision needed: location/naming for shared helpers (for example, `api/src/shared/` submodules vs `api/src/shared/data`).
- Confirm any endpoint-specific error shapes that must remain unchanged.
 - Decision: split multi-method endpoints into one handler per HTTP method to satisfy the “one method/path per handler” requirement.

## Technical Plan
### Data model changes
- Types (no new storage fields; reuse existing types):
  - `UserDocument`
  - `ParticipantDocument`
  - `UserParticipantLinkDocument`
  - `BehaviorIncidentDocument`
  - Add shared types in `api/src/shared`:
    - `CollectionResponse<T>`
    - `ProblemDetailsError` (RFC 9457 shape with `errors` array)
    - `ValidationErrorDetail`
    - Request DTOs (move from handlers into shared types): `CreateParticipantRequest`, `UpdateParticipantRequest`, `CreateBehaviorIncidentRequest`, `UpdateBehaviorIncidentRequest`
- Cosmos containers + partition keys:
  - `users` (partition key: `/id`)
  - `participants` (partition key: `/id`)
  - `userParticipantLinks` (partition key: `/userId`)
  - `behaviorIncidents` (partition key: `/participantId`)

### API shape and endpoints
- New / updated endpoints: none (refactor only). Ensure each method+route has an explicit handler mapping.

#### API Contract Template
### POST /auth/login
Auth: Anonymous (Google ID token in `Authorization: Bearer`)
Request: No JSON body
Response: `{ sub, email, name, picture, role, token }`
Errors: `401` missing/invalid Google ID token

Example response:
{ "sub": "user", "email": "user@example.com", "name": "User", "picture": "url", "role": "parent", "token": "jwt" }

### POST /auth/refresh
Auth: Anonymous (Google ID token in `Authorization: Bearer`)
Request: No JSON body
Response: `{ token }`
Errors: `401` missing/invalid Google ID token

Example response:
{ "token": "jwt" }

### GET /me
Auth: App JWT in `Authorization: Bearer`
Request: No JSON body
Response: `AppJwtPayload`
Errors: `401` missing/invalid app token

Example response:
{ "sub": "user", "email": "user@example.com", "name": "User", "picture": "url", "role": "parent", "iat": 0, "exp": 0 }

### GET /participants
Auth: App JWT in `Authorization: Bearer`
Request: Query params: `pageSize`, `nextToken`
Response: `CollectionResponse<ParticipantDocument & { role: 'manager' | 'viewer' }>`
Errors: `400` validation errors, `401` unauthorized

Example response:
{ "items": [], "nextToken": null }

### POST /participants
Auth: App JWT in `Authorization: Bearer`
Request: `CreateParticipantRequest`
Response: `ParticipantDocument`
Errors: `400` validation errors, `401` unauthorized

Example request:
{ "displayName": "Sam", "ageYears": 12 }

### GET /participants/{id}
Auth: App JWT in `Authorization: Bearer`
Request: Path param `id`
Response: `ParticipantDocument & { role: 'manager' | 'viewer' }`
Errors: `400` missing id, `401` unauthorized, `403` not linked, `404` not found

### PATCH /participants/{id}
Auth: App JWT in `Authorization: Bearer`
Request: `UpdateParticipantRequest`
Response: `ParticipantDocument & { role: 'manager' | 'viewer' }`
Errors: `400` validation, `401` unauthorized, `403` not linked/insufficient role, `404` not found

### GET /participants/{participantId}/incidents
Auth: App JWT in `Authorization: Bearer`
Request: Query params: `pageSize`, `nextToken`, `function`, `fromUtc`, `toUtc`
Response: `CollectionResponse<BehaviorIncidentDocument>`
Errors: `400` validation, `401` unauthorized, `403` not linked

### POST /participants/{participantId}/incidents
Auth: App JWT in `Authorization: Bearer`
Request: `CreateBehaviorIncidentRequest`
Response: `BehaviorIncidentDocument`
Errors: `400` validation, `401` unauthorized, `403` not linked

### GET /participants/{participantId}/incidents/{incidentId}
Auth: App JWT in `Authorization: Bearer`
Request: Path params `participantId`, `incidentId`
Response: `BehaviorIncidentDocument`
Errors: `400` missing params, `401` unauthorized, `403` not linked, `404` not found

### PATCH /participants/{participantId}/incidents/{incidentId}
Auth: App JWT in `Authorization: Bearer`
Request: `UpdateBehaviorIncidentRequest`
Response: `BehaviorIncidentDocument`
Errors: `400` validation, `401` unauthorized, `403` not linked, `404` not found

### DELETE /participants/{participantId}/incidents/{incidentId}
Auth: App JWT in `Authorization: Bearer`
Request: Path params `participantId`, `incidentId`
Response: No body
Errors: `400` missing params, `401` unauthorized, `403` not linked, `404` not found

### Frontend / UI changes
- None (backend refactor only).

### Validation + auth
- Create shared validation helpers:
  - JSON body parsing with consistent error response.
  - Standard `ProblemDetailsError` builder for validation errors.
  - Reuse validation rules across endpoints for repeated fields.
- Centralize auth:
  - Keep `authorize` for app JWT; ensure consistent error shape for `401` responses.
  - Align `me` endpoint to shared auth helper (or document explicit exception).
- Enforce “one method/path per handler”:
  - Split multi-method handlers into explicit per-method functions with one HTTP method per handler.

### Testing approach
- Unit tests for shared helpers (validation, JSON parsing, error builders, auth error mapping).
- Smoke/manual checks for each endpoint to ensure responses match pre-refactor status codes and shapes.
- Regression checks for pagination tokens and sorting behavior on list endpoints.

## Sequencing
1. Inventory existing endpoints, response shapes, and error cases (document baseline).
2. Introduce shared types and error/validation helpers in `api/src/shared`.
3. Add shared request parsing helper with consistent error responses.
4. Add shared Cosmos client/container caching in `shared/cosmos`.
5. Extract shared data-access helpers (participant link reads, incident reads, list queries).
6. Refactor each function to use shared helpers and explicit method+route mappings.
7. Validate parity with baseline responses (status + shape) and update docs/comments as needed.

## Story-Tracking Checklist
### Story 1: Consistent validation and errors
- [x] Define shared `ProblemDetailsError` shape and `ValidationErrorDetail` type.
- [x] Implement `buildValidationError` helper and replace per-handler variants.
- [x] Align validation error IDs/messages across endpoints.
- [x] Confirm non-validation errors keep current status codes and shapes.

### Story 2: Shared request parsing and auth
- [x] Add shared JSON parsing helper with consistent error response.
- [x] Ensure all authenticated endpoints use shared auth helper and error shape.
- [x] Enforce explicit method+route mapping (one method/path per handler).

### Story 3: Shared Cosmos data access
- [x] Create shared data helpers for participant link lookups and incident reads.
- [x] Update handlers to use shared data helpers with unchanged parameters.
- [ ] Verify pagination tokens and sort order remain unchanged.

### Story 4: Reuse Cosmos clients/containers
- [x] Cache Cosmos client/container map at module scope.
- [x] Ensure config changes require host restart (documented).
- [ ] Verify local dev logs show reduced client initialization.
