# Clerk Auth: Silent Token Refresh

> **Superseded by [`clerk-auth-3.md`](clerk-auth-3.md).** Once Clerk session tokens are verified directly on the API, the Clerk SDK handles token rotation automatically and this spec is no longer needed.

## Summary

When the TrackIt app JWT expires and a valid Clerk session is still present, the app currently calls `logout()` and redirects to the login screen. A silent refresh should happen instead. The API already supports this via `POST /api/auth/refresh`, which accepts a Clerk session token and returns a fresh app JWT without requiring the user to re-authenticate.

## Job to Be Done

When my session token expires in the background, I want the app to silently renew it using my existing Clerk login, so I never get bounced to the login screen mid-session without a real reason.

## Current Behavior

- `AuthService.scheduleTokenExpiry()` fires `logout()` at the exact moment the token expires with no refresh attempt.
- `authExpiredInterceptor` fires `logout()` and redirects to `/login` on any `401` response from a protected endpoint, even when a valid Clerk session exists.
- `exchangeClerkSession()` calls `/auth/login`, which is for initial login, rather than `/auth/refresh`.

## Required Behaviors

### Proactive refresh (near-expiry)

- Before the app JWT expires, `AuthService` attempts a silent refresh via `POST /api/auth/refresh` using the current Clerk session token.
- Refresh is attempted at a configurable threshold before expiry (e.g. 60 seconds before expiry) rather than waiting until the token is fully expired.
- If the Clerk session is no longer valid at refresh time, fall through to `logout()` normally.
- If the refresh API call fails for any reason, fall through to `logout()`.

### Reactive refresh (401 retry)

- When `authExpiredInterceptor` receives a `401` from a protected endpoint, it attempts one silent refresh before calling `logout()`.
- If the refresh succeeds, the original request is retried once with the new token.
- If the refresh fails or there is no active Clerk session, `logout()` and redirect to `/login` as today.
- The retry must not loop — a `401` on the retried request goes straight to `logout()`.

### Shared refresh state

- Concurrent refresh attempts are collapsed into a single in-flight call (same pattern as the existing `syncInFlightForSessionId` guard in `AuthService`).
- The `/api/auth/refresh` endpoint is used for refresh; `/api/auth/login` remains for initial session establishment only.

## Acceptance Criteria

- [ ] A user with a valid Clerk session does not see the login screen when their app JWT expires during normal usage.
- [ ] A `401` on a protected API call triggers one silent refresh attempt before redirecting to login.
- [ ] If the Clerk session has ended, the user is redirected to `/login` with a `returnUrl`.
- [ ] Concurrent refresh calls are deduplicated — only one `/api/auth/refresh` call is in flight at a time.
- [ ] The refresh endpoint used is `/api/auth/refresh`, not `/api/auth/login`.
- [ ] Build passes with no TypeScript errors.

## Out of Scope

- Changes to the `/api/auth/refresh` API endpoint contract.
- Refresh of Clerk session tokens (Clerk manages that internally).
- Offline or background sync behavior.

## References

- `docs/architecture/auth-flow.md` — `/api/auth/refresh` endpoint contract and token lifecycle
- `frontend/src/app/shared/services/auth.service.ts`
- `frontend/src/app/shared/interceptors/auth-expired.interceptor.ts`
- `docs/specs/clerk-auth-1.md`
