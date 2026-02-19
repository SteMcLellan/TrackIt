# Function API Style Standardization

Status: Draft backlog item (implementation-ready)
Last updated: 2026-02-18

## Problem

- Handler composition is inconsistent across function files.
- Several participant-scoped endpoints still do inline auth/link checks inside handlers.
- File layout under `api/src/functions` is flat and inconsistent for long-term maintainability.

## Decision

Adopt a middleware-first API handler model as the canonical style.

- Use TrackIt-owned middleware utilities under `api/src/shared/*` (no new external dependency required).
- Keep existing wrappers (`withParticipantContext`, `withAuthContext`, `withErrorHandling`) as compatibility adapters during transition.
- Update canonical guidance in `docs/architecture/api-conventions.md` to match this direction.

## Baseline middleware stacks by endpoint type

These are guidance presets, but call sites should still declare middleware explicitly.

- Public endpoints (for example auth bootstrap):
  - `errorMiddleware`
  - `requestContextMiddleware`
  - request validation middleware(s) as needed
- Authenticated non-participant endpoints:
  - `errorMiddleware`
  - `requestContextMiddleware`
  - `authMiddleware`
  - request validation middleware(s) as needed
- Participant-scoped endpoints:
  - `errorMiddleware`
  - `requestContextMiddleware`
  - `authMiddleware`
  - `participantMiddleware`
  - request validation middleware(s) as needed
- Internal admin endpoints:
  - `errorMiddleware`
  - `requestContextMiddleware`
  - `authMiddleware`
  - `adminGuardMiddleware`
  - request validation middleware(s) as needed

## Canonical middleware pipeline order

1. Error handling envelope.
2. Request normalization/parsing.
3. Auth resolution (when required).
4. Participant resolution and link validation (when required).
5. Role/admin guard (as required).
6. Request validation.
7. Business handler execution.
8. Response normalization.

## Middleware contract (proposed)

These contracts define a middleware API that stays idiomatic to Azure Functions TypeScript handler signatures and keeps configuration explicit at each endpoint.

```ts
type HttpHandler = (
  request: HttpRequest,
  context: InvocationContext
) => Promise<HttpResponseInit>;

type HttpMiddleware = (
  request: HttpRequest,
  context: InvocationContext,
  next: HttpHandler
) => Promise<HttpResponseInit>;

type RequestState = {
  containers?: CosmosContainers;
  user?: AppJwtPayload;
  participant?: {
    id: string;
    link: UserParticipantLinkDocument;
  };
  parsedBody?: unknown;
};

function getRequestState(context: InvocationContext): RequestState;
function setRequestState(context: InvocationContext, patch: Partial<RequestState>): void;

type ComposeOptions = {
  middlewares: HttpMiddleware[];
  handler: HttpHandler;
};

function composeHttpHandler(options: ComposeOptions): HttpHandler;
```

Contract rules:

- Middleware execution order is deterministic and matches the declared pipeline.
- Middleware can short-circuit by returning an `HttpResponseInit` without calling `next`.
- Middleware must not throw for expected validation/auth failures; return explicit response instead.
- Unexpected throws are allowed only for exceptional failures and are converted to `500` by error middleware.
- JSON parsing must happen once per request; parsed values should be stored via `setRequestState(...)`.
- If `authMiddleware` is in the chain, request state must include `user` and `containers` before calling `next`.
- If `participantMiddleware` is in the chain, request state must include `participant` before calling `next`.
- If `adminGuardMiddleware` is in the chain, admin authorization must be enforced before calling `next`.

## RequestState storage semantics

`RequestState` is request-scoped, in-memory middleware state. It is not persisted.

Required storage approach:

- Back `getRequestState(...)` / `setRequestState(...)` with a module-level:
  - `WeakMap<InvocationContext, RequestState>`
- `InvocationContext` is the key for one Azure Function invocation.
- Middleware and business handler for the same invocation read/write the same `RequestState`.

Constraints:

- Do not serialize `RequestState` to Cosmos, logs, or response payloads by default.
- Do not reuse `RequestState` across requests.
- Keep values small and execution-scoped (identity, parsed payload, resolved participant context, shared request resources).

## Example implementation shape

```ts
const errorMiddleware: HttpMiddleware = async (request, context, next) => {
  try {
    return await next(request, context);
  } catch (err) {
    context.error('Unhandled error', err);
    return { status: 500, jsonBody: { message: 'Internal error' } };
  }
};

export function composeHttpHandler(options: ComposeOptions): HttpHandler {
  const chain = options.middlewares;

  return chain.reduceRight<HttpHandler>(
    (next, middleware) => (request, context) => middleware(request, context, next),
    options.handler
  );
}

const createMedicationHandler = composeHttpHandler({
  middlewares: [
    errorMiddleware,
    requestContextMiddleware,
    authMiddleware,
    participantMiddleware({
      participantParamName: 'participantId',
      missingParticipantErrorId: 'medications.participantId.required',
      missingParticipantErrorMessage: 'Participant id is required.'
    }),
    validateCreateMedicationBodyMiddleware
  ],
  handler: createMedicationBusinessHandler
});
```

## File organization target

Target structure for new/refactored endpoints:

- `api/src/functions/<resource>/<action>.ts` (primary handler registration and composition)
- optional companion modules by resource:
  - `schema.ts`
  - `types.ts`
  - `service.ts`
  - `index.ts`

Tests remain under `api/tests/handlers/*` with consistent `<resource>-<action>.test.ts` naming.

## API audit matrix

Matrix is prefilled with current-state composition and explicit target middleware stack for all registered endpoints (`app.http(...)`).

| Done | Function | Method + Route | Source file | Current composition | Target middleware stack | Current gap | Tests aligned |
|---|---|---|---|---|---|---|---|
| [ ] | `auth-login` | `POST /auth/login` | `api/src/functions/auth-login.ts` | `withErrorHandling` only | `error -> requestContext -> [validation]` | Needs explicit middleware stack wiring | [ ] |
| [ ] | `auth-refresh` | `POST /auth/refresh` | `api/src/functions/auth-refresh.ts` | `withErrorHandling` only | `error -> requestContext -> [validation]` | Needs explicit middleware stack wiring | [ ] |
| [ ] | `me` | `GET /me` | `api/src/functions/me.ts` | `withAuthContext` | `error -> requestContext -> auth -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `participants-list` | `GET /participants` | `api/src/functions/participants.ts` | `withAuthContext` | `error -> requestContext -> auth -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `participants-create` | `POST /participants` | `api/src/functions/participants.ts` | `withAuthContext` | `error -> requestContext -> auth -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `participant-detail-get` | `GET /participants/{id}` | `api/src/functions/participant-detail.ts` | `withParticipantContext` (`participantParamName='id'`) | `error -> requestContext -> auth -> participant -> [validation]` | Keep compatibility route param behavior explicit | [ ] |
| [ ] | `participant-detail-patch` | `PATCH /participants/{id}` | `api/src/functions/participant-detail.ts` | `withParticipantContext` (`participantParamName='id'`) | `error -> requestContext -> auth -> participant -> [validation]` | Keep compatibility route param behavior explicit | [ ] |
| [ ] | `participant-members-list` | `GET /participants/{participantId}/members` | `api/src/functions/participant-members.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `participant-members-revoke` | `DELETE /participants/{participantId}/members/{userId}` | `api/src/functions/participant-members.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `participant-invites-active-get` | `GET /participants/{participantId}/invites/active` | `api/src/functions/participant-invites.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `participant-invites-create` | `POST /participants/{participantId}/invites` | `api/src/functions/participant-invites.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `participant-invites-accept` | `POST /participants/{participantId}/invites/{inviteId}/accept` | `api/src/functions/participant-invites.ts` | `withAuthContext` | `error -> requestContext -> auth -> [validation]` | Confirm auth-only stack is intentional | [ ] |
| [ ] | `behavior-incidents-list` | `GET /participants/{participantId}/incidents` | `api/src/functions/behavior-incidents.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `behavior-incidents-create` | `POST /participants/{participantId}/incidents` | `api/src/functions/behavior-incidents.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `behavior-incident-detail-get` | `GET /participants/{participantId}/incidents/{incidentId}` | `api/src/functions/behavior-incident-detail.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `behavior-incident-detail-patch` | `PATCH /participants/{participantId}/incidents/{incidentId}` | `api/src/functions/behavior-incident-detail.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `behavior-incident-detail-delete` | `DELETE /participants/{participantId}/incidents/{incidentId}` | `api/src/functions/behavior-incident-detail.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `medications-list` | `GET /participants/{participantId}/medications` | `api/src/functions/medications.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `medications-create` | `POST /participants/{participantId}/medications` | `api/src/functions/medications.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `medication-detail-get` | `GET /participants/{participantId}/medications/{medicationId}` | `api/src/functions/medication-detail.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `medication-detail-patch` | `PATCH /participants/{participantId}/medications/{medicationId}` | `api/src/functions/medication-detail.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `medication-logs-list` | `GET /participants/{participantId}/medication-logs` | `api/src/functions/medication-logs.ts` | `withErrorHandling` + inline auth/link checks | `error -> requestContext -> auth -> participant -> [validation]` | High-priority normalization gap | [ ] |
| [ ] | `medication-logs-upsert` | `PUT /participants/{participantId}/medication-logs/{medicationId}/{logLocalDate}` | `api/src/functions/medication-logs.ts` | `withErrorHandling` + inline auth/link checks | `error -> requestContext -> auth -> participant -> [validation]` | High-priority normalization gap | [ ] |
| [ ] | `medication-logs-as-needed-create` | `POST /participants/{participantId}/medication-logs/{medicationId}/{logLocalDate}/as-needed` | `api/src/functions/medication-logs.ts` | `withErrorHandling` + inline auth/link checks | `error -> requestContext -> auth -> participant -> [validation]` | High-priority normalization gap | [ ] |
| [ ] | `medication-log-detail-get` | `GET /participants/{participantId}/medication-logs/{logId}` | `api/src/functions/medication-log-detail.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `medication-log-detail-delete` | `DELETE /participants/{participantId}/medication-logs/{logId}` | `api/src/functions/medication-log-detail.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `daily-reflections-list` | `GET /participants/{participantId}/daily-reflections` | `api/src/functions/daily-reflections.ts` | `withErrorHandling` + inline auth/link checks | `error -> requestContext -> auth -> participant -> [validation]` | High-priority normalization gap | [ ] |
| [ ] | `daily-reflections-upsert` | `PUT /participants/{participantId}/daily-reflections/{logLocalDate}` | `api/src/functions/daily-reflections.ts` | `withErrorHandling` + inline auth/link checks | `error -> requestContext -> auth -> participant -> [validation]` | High-priority normalization gap | [ ] |
| [ ] | `daily-reflections-summary` | `GET /participants/{participantId}/daily-reflections/summary` | `api/src/functions/daily-reflections.ts` | `withErrorHandling` + inline auth/link checks | `error -> requestContext -> auth -> participant -> [validation]` | High-priority normalization gap | [ ] |
| [ ] | `timeline-list` | `GET /participants/{participantId}/timeline` | `api/src/functions/timeline.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `timeline-context` | `GET /participants/{participantId}/timeline/context/{sourceType}/{sourceId}` | `api/src/functions/timeline.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `event-index-list` | `GET /participants/{participantId}/event-index` | `api/src/functions/event-index.ts` | `withParticipantContext` | `error -> requestContext -> auth -> participant -> [validation]` | Convert wrapper-first docs to explicit stack mapping | [ ] |
| [ ] | `admin-timeline-backfill` | `POST /internal/admin/migrations/event-index/backfill` | `api/src/functions/admin-event-index-migrations.ts` | `withErrorHandling` + `requireAdmin` inline | `error -> requestContext -> auth -> adminGuard -> [validation]` | Normalize via explicit admin middleware stack | [ ] |
| [ ] | `admin-timeline-verify` | `POST /internal/admin/migrations/event-index/verify` | `api/src/functions/admin-event-index-migrations.ts` | `withErrorHandling` + `requireAdmin` inline | `error -> requestContext -> auth -> adminGuard -> [validation]` | Normalize via explicit admin middleware stack | [ ] |

## Acceptance criteria

- Backlog doc explicitly defines middleware-first canonical direction.
- Matrix includes all currently registered HTTP endpoints.
- Each endpoint row has current composition, target middleware stack, and gap.
- Compatibility behavior for `participants/{id}` is retained and explicit.
- Canonical architecture docs are updated to stay consistent with this backlog item.

## Out of scope

- Endpoint contract changes (routes, payload shapes, status semantics).
- Dependency changes to external middleware libraries.
- Rollout phasing or sprint planning details.

## Residual risks and notes

- Wrapper adapters may coexist with middleware composition during transition; drift risk remains unless PR checks enforce explicit stack declaration.
- `participant-invites-accept` route currently uses auth-only context; verify this remains intentional during implementation.
