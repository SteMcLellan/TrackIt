# Frontend Engineering Conventions

This document defines Angular implementation conventions for TrackIt frontend code.

## Framework and Component Model

- Use standalone components only (no NgModules).
- Use `ChangeDetectionStrategy.OnPush` for all components.
- Prefer dependency-light implementations.

## State Management

- Use Angular signals for local and simple component/service state.
- Do not introduce `BehaviorSubject` or `Subject` for simple state.
- Use RxJS for HTTP and stream orchestration where needed.

## Component Structure

- Keep templates and styles inline in component files.
- Keep components focused and colocated by feature (`frontend/src/app/features/...`).
- Inject dependencies with `inject()`.

## Active Participant Context

Most feature pages depend on active participant context.

- Use route protections with `ActiveParticipantGuard` where required.
- Read active participant from the context service signal.

See `docs/architecture/participant-association.md` for full details.

## Related Docs

- `docs/architecture/frontend-interaction-principles.md`
- `docs/architecture/page-shell.md`
- `docs/architecture/participant-association.md`
