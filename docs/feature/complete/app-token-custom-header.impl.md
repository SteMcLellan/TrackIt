# Implementation Plan: App Auth Token via Custom Header (SWA-Safe)

## Scope Recap
- Switch TrackIt’s **app JWT** transport from `Authorization: Bearer ...` to a TrackIt-specific custom header (default: `x-trackit-app-token`) to avoid SWA/proxy interference.
- Keep the Google login exchange working (currently sends Google ID token in the request body).
- Minimal changes; no rollout/dual-support required.

## Assumptions / Open Questions
- Decision: use `x-trackit-app-token` as the header name.
- After the switch, existing stored sessions may break; UX should cleanly prompt re-login when API returns 401.

## Technical Plan
### Data model changes
- None.

### API shape and endpoints
- No endpoint shape changes.
- Authorization behavior changes:
  - All endpoints that call `authorize(...)` will read the app token from `x-trackit-app-token` instead of the `Authorization` header.

#### API Contract Template
### Authenticated endpoints (all existing)
Auth: require `x-trackit-app-token: <appJwt>`
Errors: return `401` when missing/invalid token; do not return `500` for token validation failures.

### Frontend / UI changes
- Update the HTTP interceptor so that:
  - For authenticated users, it sends `x-trackit-app-token` with the app JWT.
  - It does **not** overwrite an explicitly set `Authorization` header (keep this behavior so `/auth/*` flows remain unbroken if they ever use Authorization again).
  - It does not attach the header when no token exists.
- Ensure any code that explicitly sets `Authorization` (if any) remains untouched.

### Validation + auth
- Backend:
  - Update `authorize()` to read `x-trackit-app-token`.
  - When verification fails, throw a 401 (not a 500) with a safe message (no token echo).
- Frontend:
  - On 401 from protected endpoints, the app should route to login as it does today (AuthGuard flow). If there’s any “stuck” state, add a minimal “session expired” hint on login page (optional).

### Testing approach
- Frontend:
  - `npm run dev:frontend:log` shows “Application bundle generation complete” in `dist/frontend/dev-frontend.log`.
  - In DevTools Network, verify authenticated calls include `x-trackit-app-token` and do not depend on `Authorization`.
- API:
  - `npm run build:api` succeeds.
- Manual SWA check:
  - Login works.
  - `GET /api/participants?pageSize=50` works consistently (no “invalid signature”).

## Sequencing
1. Frontend: switch interceptor to set `x-trackit-app-token` with the app JWT.
2. API: switch `authorize()` to read `x-trackit-app-token` and return 401 on verification failures.
3. Verify local build/logs and SWA behavior.

## Completion Notes
- `npm run build:api` succeeds locally (tsc + copy metadata).
- SWA auth requests now reach Functions with `x-trackit-app-token`; `/api/participants?pageSize=50` returns 200 post-login without signature errors.
- Local dev verification: frontend dev log shows a successful Angular bundle once the local server resolves port collision.

## Story-Tracking Checklist
### Story 1: Use custom header for app JWT
- [x] Frontend sends app JWT via `x-trackit-app-token` for authenticated API calls.
- [x] API reads `x-trackit-app-token` in `authorize()` and returns 401 (not 500) for invalid signatures.
- [x] SWA deployment: authenticated API calls succeed reliably after login.
