# Clerk Auth: Direct Token Verification

## Summary

TrackIt currently exchanges Clerk session tokens for a custom HS256 app JWT at login, stores
that JWT in localStorage, and manages its expiry manually. This is redundant: Clerk is already
the identity provider, `@clerk/backend`'s `verifyToken()` is already installed on the API, and
the Clerk browser SDK handles token rotation automatically. Eliminating the app JWT layer removes
the exchange endpoints, all token lifecycle code on the frontend, and the need for the silent
refresh spec (clerk-auth-2.md).

Admin endpoint protection moves to Clerk `publicMetadata` — set `{ roles: ["admin"] }` on admin
users in the Clerk Dashboard and embed it in the session token via a Clerk JWT template. No DB
lookup or env var needed. Participant-level access control (manager/viewer) remains DB-driven
because revocation must be immediate and Clerk's org-based permission system is not a good fit
for per-participant relationships.

## Job to Be Done

When I use TrackIt, I want authentication to be invisible and never interrupt my session, so I
can focus on the app without being logged out or prompted to re-authenticate while my Clerk
session is still active.

## Required Behaviors

- Protected API endpoints verify the Clerk session token directly from the `Authorization: Bearer`
  header using `verifyToken()` from `@clerk/backend`. No app JWT exchange step.
- The frontend sends a fresh Clerk session token on every API request. The Clerk browser SDK
  manages token rotation automatically — no expiry timers, no localStorage token, no explicit
  refresh call.
- Signing in with Clerk immediately grants access to the app. No secondary `/api/auth/login`
  call is required.
- The admin endpoint checks the `metadata.roles` claim embedded in the Clerk session token via
  a Clerk JWT template. A user is admin if their Clerk `publicMetadata` includes `"admin"` in
  the roles array. This is configured in the Clerk Dashboard, not in the TrackIt codebase.
- Participant-level access control (manager vs viewer) continues to be enforced by the
  participant middleware via a live DB lookup. This is intentional: participant link revocation
  must take effect immediately, and the Clerk token's ~60-second rotation window is not
  acceptable latency for access revocation.
- Signing out ends the Clerk session and clears all local app state.
- A `401` response from a protected endpoint redirects to `/login` with a `returnUrl`.

## Acceptance Criteria

- [ ] No calls to `/api/auth/login` or `/api/auth/refresh` at any point in the sign-in or
      session lifecycle.
- [ ] No `trackit.appUser` key in `localStorage` after sign-in.
- [ ] Protected API calls succeed with a Clerk session token in the `Authorization: Bearer`
      header.
- [ ] Clerk token rotation (~60s interval) causes no visible disruption to the user.
- [ ] A user with `publicMetadata.roles` including `"admin"` (embedded via Clerk JWT template)
      can reach the admin endpoint.
- [ ] A user without the admin claim receives `403` from the admin endpoint.
- [ ] TypeScript build passes for both frontend and API with no errors.

## Out of Scope

- Participant role management via Clerk Organizations.
- Machine-to-machine auth.
- Changes to the caregiver invite or participant link revoke flows.
- Clerk JWT template configuration (that is a Clerk Dashboard task, not a code change).

## Supersedes

- `docs/specs/clerk-auth-2.md` — silent token refresh is no longer needed once Clerk session
  tokens are used directly.

## References

- `docs/architecture/auth-flow.md`
- `docs/specs/clerk-auth-1.md`
- `docs/specs/clerk-auth-2.md`
