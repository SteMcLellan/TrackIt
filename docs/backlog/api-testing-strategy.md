# API Testing Strategy

Last updated: 2026-02-15
Status: Scaffolding — needs first test before committing to pattern

## Problem

The API has 17 Azure Functions and zero tests. Changes to shared logic (auth, Cosmos queries, timeline projections, validation) can silently break multiple endpoints. There's no way to verify correctness without manual testing against a running instance.

## Goals

- Catch regressions in validation, auth, and data access logic.
- Enable confident refactoring of shared code (`authorize`, `buildCosmos`, timeline projectors).
- Run tests fast enough to use during development (seconds, not minutes).

## Non-Goals

- 100% coverage — focus on high-value paths first.
- E2E/integration tests against a live Cosmos instance (Phase 2 concern).
- Testing the Azure Functions runtime itself (route registration, host behavior).

## Current Testability

Strengths:
- Handlers are exported as standalone async functions.
- `withErrorHandling` centralizes error handling.
- Validation is separated into pure functions (e.g. `validateCreateRequest`).
- `Result<T>` pattern makes success/failure paths explicit.

Challenges:
- `buildCosmos()` is called inline in every handler with a module-level singleton cache — can't inject mock containers without mocking the module.
- `authorize()` reads headers directly from `HttpRequest` — need to construct mock request objects.
- `containers` is typed as `Record<string, Container>` — no compiler help for typos.
- No test framework, config, or utilities exist yet.

## Prerequisite Refactoring: Handler Context Pattern

Before writing Tier 2 tests, refactor handlers to accept a context object instead of calling `buildCosmos()` and `authorize()` inline. This eliminates module-level mocking entirely.

### Step 1: Type the containers map

Replace `Record<string, Container>` with a typed interface:

```typescript
export interface CosmosContainers {
  users: Container;
  participants: Container;
  userParticipantLinks: Container;
  participantInvites: Container;
  medications: Container;
  medicationLogs: Container;
  behaviorIncidents: Container;
  dailyReflections: Container;
  eventIndex: Container;
}
```

Update `buildCosmos` return type accordingly. No handler changes needed — they already destructure by name.

### Step 2: Extract `withParticipantContext` wrapper

Most handlers (~15 of 17) repeat the same preamble:

```typescript
const user = authorize(context, req);
const { containers } = await buildCosmos();
const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
if (!link) return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
```

Extract this into a wrapper:

```typescript
type ParticipantContext = {
  user: AppJwtPayload;
  containers: CosmosContainers;
  participantId: string;
  link: UserParticipantLink;
};

function withParticipantContext(
  handler: (ctx: ParticipantContext, req: HttpRequest) => Promise<HttpResponseInit>
): (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit> {
  return withErrorHandling(async (req, context) => {
    const user = authorize(context, req);
    const participantId = req.params.participantId;
    if (!participantId) {
      return buildValidationError([{ id: 'participantId.required', message: 'Participant id is required.' }]);
    }
    const { containers } = await buildCosmos();
    const link = await readParticipantLink(containers.userParticipantLinks, user.sub, participantId);
    if (!link) {
      return { status: 403, jsonBody: { message: 'Participant not linked to user.' } };
    }
    return handler({ user, containers, participantId, link }, req);
  });
}
```

Handlers become just business logic:

```typescript
const listMedicationsHandler = withParticipantContext(async (ctx, req) => {
  const pageSize = parsePageSize(req.query.get('pageSize'));
  const query = buildMedicationListQuery(ctx.participantId, includeArchived);
  const response = await ctx.containers.medications.items.query(...);
  return { status: 200, jsonBody: { items: response.resources, nextToken: ... } };
});
```

### Step 3: Similar wrapper for non-participant endpoints

`auth-login`, `auth-refresh`, `me`, and admin endpoints don't use participant context. These need lighter wrappers:

- `withAuthContext` — resolves auth + cosmos, no participant check (for `me`, admin)
- Auth endpoints keep their current structure (they're anonymous, only 2 handlers)

### Testing benefit

Tier 2 tests call the inner handler directly with a hand-built context — no module mocking:

```typescript
const result = await innerHandler(
  { user: fakeUser, containers: stubContainers, participantId: 'p1', link: fakeLink },
  mockRequest
);
expect(result.status).toBe(200);
```

### Migration order

1. Add `CosmosContainers` type (Step 1) — safe, no behavior change.
2. Add `withParticipantContext` wrapper — new code, nothing uses it yet.
3. Migrate one handler (medications) and write its tests — validate the pattern.
4. Migrate remaining handlers incrementally.

## Testing Tiers

### Tier 1: Pure logic (start here)

Zero dependencies, fast, high confidence. Test these first:

- **Validation functions**: `validateCreateRequest`, `isDateOnly`, `parsePageSize`, `parseIncludeArchived`, etc.
- **Query builders**: `buildMedicationListQuery`, `buildMedicationLogListQuery`, etc.
- **Timeline projectors**: `projectMedicationToEventIndex`, etc.
- **Error builders**: `buildValidationError`

These are pure functions — no mocking required.

### Tier 2: Handler logic with injected context

After the handler context refactoring, test inner handlers directly by passing a hand-built `ParticipantContext` with stub containers. No module mocking needed. Test:

- **Validation integration**: handler returns 422 with correct error IDs for bad input.
- **Happy path**: handler returns correct status code and shape for valid input.
- **Edge cases**: pagination, optional fields, archived filtering.
- **Wrapper tests** (separate, small suite): `withParticipantContext` returns 401 on bad auth, 403 on missing participant link.

### Tier 3: Integration tests (deferred)

Against the Cosmos emulator or a test Cosmos DB. Validates:

- Actual query behavior (partition keys, composite indexes, continuation tokens).
- Upsert/create semantics.
- Timeline write-through consistency.

Out of scope for initial implementation.

## Framework: Vitest

**Decision: Vitest for both API and frontend tests.**

- Angular 21 made Vitest the official default test runner (stable, not experimental). Jest and Web Test Runner are deprecated and planned for removal in v22.
- The frontend currently uses Karma/Jasmine — migration to Vitest is a separate effort but aligns with Angular's direction.
- For API tests, Vitest runs natively on Node with first-class TypeScript/ESM support and no transform config.
- Same `describe`/`it`/`expect` syntax as Jasmine — test bodies carry over with minimal changes.
- One test runner across both projects long-term.

## Proposed File Structure

```
api/
├── vitest.config.ts
├── src/
│   ├── functions/
│   │   └── medications.ts
│   └── shared/
│       └── data/
│           └── medications.ts
└── tests/
    ├── unit/
    │   ├── validators/
    │   │   └── medications.test.ts      # Tier 1: pure validation
    │   ├── queries/
    │   │   └── medications.test.ts      # Tier 1: query builders
    │   └── projectors/
    │       └── medications.test.ts      # Tier 1: timeline projectors
    └── handlers/
        ├── medications.test.ts          # Tier 2: handler with mocks
        └── auth-login.test.ts           # Tier 2: auth flow
```

## Suggested First Tests

Start with one vertical slice to validate the full pattern:

1. **Tier 1**: `validateCreateRequest` from medications — has date logic, enum validation, range checks.
2. **Tier 1**: `buildMedicationListQuery` — verifies SQL and parameter construction.
3. **Tier 2**: `createMedicationHandler` — call inner handler with stub `ParticipantContext`, assert response shape.

If those three work cleanly, the pattern can be replicated across all 17 endpoints.

## Open Questions

- **Mock request construction**: Should we build a lightweight `mockHttpRequest()` helper, or use a library? The `@azure/functions` types are relatively simple — a hand-rolled helper is probably sufficient.
- **Test script naming**: `test:api` in root `package.json` to mirror `test:frontend`?
- **CI integration**: Run on PR? Probably yes, but deferred until tests exist.
- **Frontend Karma → Vitest migration**: Separate effort, not blocking API tests. Angular provides migration schematics.

## Related Docs

- `docs/architecture/api-conventions.md` — handler patterns and `Result<T>`
- `docs/architecture/auth-flow.md` — auth token flow
- `docs/architecture/data-modeling.md` — Cosmos schema and time conventions
