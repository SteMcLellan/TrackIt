# API Testing

This runbook describes the API test setup and how to add new tests.

## Commands

Ask for elevated permissions before running tests due to esbuild spawn (`EPERM`).

```bash
npm run test:api
npm --workspace api run test:watch
npm --workspace api run test:coverage
```

## Structure

- `api/tests/unit/*.test.ts`: Tier 1 pure function tests.
- `api/tests/handlers/*.test.ts`: Tier 2 handler and wrapper tests.
- `api/tests/helpers/*`: shared request/context/container test helpers.

## Current Pattern

- Prefer pure function tests first for validation/query/projector logic.
- For handler tests, call exported inner handlers (for example `createMedicationInnerHandler`) with a hand-built context.
- Keep wrapper tests separate to validate auth, participant checks, and error contracts once.

## Route Coverage Tracker

- `medications-list`: covered
- `medications-create`: covered
- `participants-list`: covered
- `participants-create`: covered
- `participant-detail-get`: covered
- `participant-detail-patch`: covered
- `participant-members-list`: covered
- `participant-members-revoke`: covered
- `participant-invites-active-get`: covered
- `participant-invites-create`: covered
- `participant-invites-accept`: covered
- `me`: covered
- `behavior-incidents-list`: covered
- `behavior-incidents-create`: covered
- `behavior-incident-detail-get`: covered
- `behavior-incident-detail-patch`: covered
- `behavior-incident-detail-delete`: covered
- `timeline-list`: covered
- `timeline-context`: covered
- `event-index-list`: covered
- `medication-detail-get`: covered
- `medication-detail-patch`: covered
- `medication-log-detail-get`: covered
- `medication-log-detail-delete`: covered
- Remaining routes: pending (Wave 3+)
