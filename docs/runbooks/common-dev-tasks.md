# Common Development Tasks

This runbook captures common implementation workflows in TrackIt.

## Add a New API Endpoint

1. Create `api/src/functions/{resource}-{action}.ts`.
2. Compose handler with `composeHttpHandler({ middlewares: [...], handler })`.
3. Add middleware for route scope:
   - `errorMiddleware` + `requestContextMiddleware` baseline.
   - `authMiddleware` for protected routes.
   - `participantMiddleware` for participant-scoped routes.
   - `adminGuardMiddleware` for admin-only routes.
4. Register endpoint with `app.http()`.
5. Validate request/response and time fields against `docs/architecture/data-modeling.md`.

## Add a New Frontend Component

1. Create component in `frontend/src/app/features/{feature}/`.
2. Keep component standalone and set `ChangeDetectionStrategy.OnPush`.
3. Keep template and styles inline.
4. Use signals for local state.
5. Add to route/import graph and verify mobile layout behavior.

## Add a New Model

1. Backend model: add `*Document` type in `api/src/models/`.
2. Frontend model: add interface in `frontend/src/app/shared/models/`.
3. Include UTC plus local date/time context where event timing matters.

## Stitch Conversion Task

1. Implement component from Stitch design.
2. Add required Stitch metadata block above `@Component(...)`.
3. Update `DESIGN.md` if new reusable patterns were introduced.
4. Run `npm run build:frontend`.

## Run Ralph Loop

1. Add or update specs in `docs/product-specs/` (feature specs) or `docs/architecture/` (system design).
2. Run `.\tools\ralph-loop.ps1 -Mode plan -MaxIterations 1` to refresh `IMPLEMENTATION_PLAN.md`.
3. Run `.\tools\ralph-loop.ps1 -Mode build -MaxIterations 1` to execute one planned task.
4. Put validation and commit behavior in the prompt and review the session logs in `artifacts/ralph-loop/` if a loop iteration fails.

## Related Docs

- `docs/architecture/api-conventions.md`
- `docs/architecture/frontend-engineering-conventions.md`
- `docs/references/stitch-workflow.md`
