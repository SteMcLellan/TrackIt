# API Conventions

This document defines backend endpoint conventions for TrackIt Azure Functions.

## Error and Auth Wrappers

- Wrap handlers with `withErrorHandling`.
- Use `authorize()` for protected endpoints.
- Use `requireAdmin()` for admin-only internal endpoints.

## Result Pattern

For expected failures, prefer explicit result types instead of throwing:

```typescript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; response: HttpResponseInit };
```

Reserve thrown errors for unexpected failures.

## Routing and Naming

- Function files use kebab-case: `api/src/functions/{resource}-{action}.ts`.
- Keep route naming consistent with resource semantics.
- Do not place custom routes under `/admin/*` because it is host-reserved.

## Time and Data Contracts

- Preserve UTC plus local context requirements from `docs/architecture/data-modeling.md`.
- Keep domain containers as source of truth and projection logic idempotent.

## Timeline Read Contracts

- `GET /participants/{participantId}/timeline` is a projected read model (day-window final state), not a raw event stream.
- `GET /participants/{participantId}/event-index` is the raw append-only stream for audit/debug use cases.

## Related Docs

- `docs/architecture/auth-flow.md`
- `docs/architecture/data-modeling.md`
