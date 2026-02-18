# API Conventions

This document defines backend endpoint conventions for TrackIt Azure Functions.

## Handler Architecture
- Keep each endpoint in a function file under `api/src/functions/` using kebab-case filenames.
- Use a two-layer handler structure:
  - Outer registered handler via wrapper (`withAuthContext`, `withParticipantContext`, or `withErrorHandling`).
  - Inner business handler exported for direct unit tests.
- Keep `app.http(...)` registration near the bottom of the file.
- Keep shared request/data helpers in `api/src/shared/*` and `api/src/shared/data/*`.

## Wrappers and Auth
- `withErrorHandling` is the outer safety net for unexpected exceptions and consistent 500 responses.
- `withAuthContext` is for user-authenticated, non-participant-scoped endpoints (for example `GET /participants`, `GET /me`).
- `withParticipantContext` is for participant-scoped endpoints and enforces:
  - JWT auth
  - required route participant param
  - user-to-participant link existence
- Use `requireAdmin()` for internal admin-only endpoints under `internal/admin/...`.

## Request Parsing and Result Pattern
- Parse JSON bodies through `parseJsonBody<T>()`; do not parse request JSON inline in handlers.
- For expected failures, prefer explicit result unions and `HttpResponseInit` returns instead of throws:

```typescript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; response: HttpResponseInit };
```

- Reserve thrown errors for truly unexpected failures that should be handled by `withErrorHandling`.

## Validation and Error Shape
- Validation responses must use `buildValidationError(...)` and return:
  - status `400`
  - content type `application/problem+json`
  - stable machine-readable error IDs
- Validation error IDs should follow `<resource>.<field_or_context>.<reason>`.
  - Example: `participants.birthDate.invalid`
- Keep user-facing messages concise and actionable.

## Status Code Conventions
- `200`: successful read/update/delete-by-command response.
- `201`: successful create.
- `400`: validation or malformed request input.
- `401`: invalid/missing auth token (when wrapper/auth validation fails before domain checks).
- `403`: authenticated but not allowed (missing participant link or role constraints).
- `404`: resource not found within authorized scope.
- `500`: unexpected failure path handled by wrapper.

## Route and Function Naming
- Function registration names use `<resource>-<action>`.
  - Examples: `participants-list`, `participant-detail-patch`, `medication-logs-upsert`.
- Route nouns should be resource-based and consistent.
- Participant-scoped routes should prefer `{participantId}` as parameter name.
- Current compatibility exception:
  - `participants/{id}` exists in participant detail routes; keep compatibility, but prefer `{participantId}` for new routes.
- Do not place custom routes under `/admin/*` because it is host-reserved.
- Use `internal/admin/...` for internal administrative endpoints.

## Authorization and Role Checks
- Participant-linked access is required before reading/writing participant-scoped documents.
- Keep coarse auth in wrappers; keep fine-grained role checks in inner handlers.
  - Example: manager-only participant update checks in `participant-detail`.
- Return `403` for role mismatch with explicit reason text.

## Data Access and Partition Scope
- Build Cosmos containers once per request via wrapper context.
- Prefer `api/src/shared/data/*` helpers for reads/queries to avoid duplicate query logic.
- Keep reads and writes aligned with documented partition strategy in `docs/architecture/data-modeling.md`.
- Avoid cross-partition fan-out on primary read paths.

## Query, Pagination, and Filtering
- Query params should be parsed and normalized by small helper functions.
- Use bounded pagination:
  - default page size `25`
  - max page size `100`
- Continuation-token style pagination should return `nextToken: string | null`.
- Invalid query values should fall back to safe defaults or return explicit validation errors when needed.

## Time and Data Contracts
- Preserve UTC plus local context requirements from `docs/architecture/data-modeling.md`.
- Keep domain containers as source of truth.
- Projection writes (for example timeline index) must remain idempotent.

## Timeline Read Contracts
- `GET /participants/{participantId}/timeline` is a projected read model (day-window final state), not a raw event stream.
- `GET /participants/{participantId}/event-index` is the raw append-only stream for audit/debug use cases.

## Testing Conventions
- Unit-test inner handlers directly for business behavior and validation.
- Test wrappers separately for auth, participant link, and error handling behavior.
- Keep helper factories under `api/tests/helpers/*`.
- Prefer deterministic tests that avoid network and runtime dependencies.

## Golden Endpoint Template
```typescript
const createThingInnerHandler = async (
  ctx: ParticipantContext,
  req: HttpRequest
): Promise<HttpResponseInit> => {
  if (ctx.link.role !== 'manager') {
    return { status: 403, jsonBody: { message: 'Manager role required.' } };
  }

  const parsed = await parseJsonBody<CreateThingRequest>(req, {
    id: 'things.body.invalid',
    message: 'Request body must be valid JSON.'
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  const errors = validateCreateThingRequest(parsed.value);
  if (errors.length > 0) {
    return buildValidationError(errors);
  }

  const created = await createThing(ctx.containers.things, ctx.participantId, parsed.value);
  return { status: 201, jsonBody: created };
};

const createThingHandler = withParticipantContext(
  { missingParticipantErrorId: 'things.participantId.required' },
  createThingInnerHandler
);
```

## PR Checklist
- Correct wrapper selected (`withAuthContext`, `withParticipantContext`, or admin + error wrapper).
- Route naming and function name follow conventions.
- Participant param naming is consistent (`participantId` for new endpoints).
- Validation errors use stable IDs and `buildValidationError`.
- Status codes align with this doc.
- Partition-aware data access (no accidental cross-partition primary path).
- Tests include inner-handler behavior and wrapper behavior.

## Related Docs
- `docs/architecture/auth-flow.md`
- `docs/architecture/data-modeling.md`
- `docs/references/repo-conventions.md`
