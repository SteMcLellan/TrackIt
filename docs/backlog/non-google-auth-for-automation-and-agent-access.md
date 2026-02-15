# Non-Google Auth for Automation and Agent Access

Last updated: 2026-02-15  
Status: Exploring options, ready to scope implementation

## Problem

TrackIt currently requires Google sign-in to obtain an app JWT.
This blocks:
- Automated scripts that call protected APIs without manual browser login/token copy.
- Codex/Claude workflows that need authenticated page/API access for exploration and testing.

## Goals

- Support non-Google authentication paths to mint app JWTs.
- Enable secure, low-friction machine access for automation.
- Enable easy authenticated access for local/staging agent-driven exploration.

## Non-Goals

- Replacing Google sign-in for end users.
- Building full username/password account management.

## Current State

- `/api/auth/login` and `/api/auth/refresh` require a Google ID token.
- Protected APIs require app JWT via `x-trackit-app-token`.

## Options Considered

1. Service accounts issuing short-lived app JWTs (recommended for production automation).
2. Personal access tokens (PATs) for user-owned scripts.
3. Dev bootstrap endpoint for local/staging agent access (recommended for Codex/Claude exploration).
4. Username/password auth (deferred due to higher security/maintenance cost).

## Proposed Direction

Phase 1:
- Add service-account auth flow for script automation.
- Add dev bootstrap auth endpoint for local/staging only.
- Keep Google auth flow unchanged for interactive user login.

Phase 2 (optional):
- Add PATs for user-managed script access.

## Security Notes

- Short token TTLs, scoped claims/roles, and audience validation.
- Explicit revocation/rotation for service credentials.
- Dev bootstrap disabled in production and protected by strict allowlists/keys.
- Consider accepting `Authorization: Bearer <app_jwt>` in addition to `x-trackit-app-token` for tool compatibility.

## Initial Acceptance Criteria

- Script can obtain app JWT non-interactively and call protected endpoints.
- Codex/Claude can authenticate in local/staging without Google popup flow.
- Existing Google login continues to work unchanged.
- Auth failures are explicit and auditable.
