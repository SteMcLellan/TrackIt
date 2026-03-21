# Clerk Auth Migration

Last updated: 2026-03-20  
Status: Ready to scope implementation

## Problem

TrackIt currently uses a two-step auth model:

1. Google Identity Services signs the user in on the frontend.
2. The API verifies the Google ID token and exchanges it for a TrackIt app JWT.

This creates product and engineering friction:

- Interactive sign-in is tied to Google.
- The frontend login UI depends on Google-specific scripts and services.
- The backend login and refresh endpoints are coupled to Google JWKS and `GOOGLE_CLIENT_ID`.
- Any future auth-provider change requires touching both frontend login and backend token exchange code.

## Goals

- Replace Google sign-in with Clerk for interactive user authentication.
- Preserve existing protected API behavior during the first migration phase.
- Make the final auth model simpler by allowing the API to trust Clerk directly.
- Keep frontend auth state aligned with Clerk session claims instead of a TrackIt-managed user token model.

## Non-Goals

- Reworking TrackIt authorization rules or role semantics.
- Moving participant-role ownership into Clerk organizations in this effort.
- Combining this work with service-account or PAT work for automation.
  That remains separate in `docs/backlog/non-google-auth-for-automation-and-agent-access.md`.
- Rebuilding the login screen visual design beyond what Clerk integration requires.

## Current State

- Frontend:
  - `frontend/src/index.html` loads Google Identity Services.
  - `frontend/src/environments/environment*.ts` expose `googleClientId`.
  - `frontend/src/app/shared/services/google-identity.service.ts` waits for GIS.
  - `frontend/src/app/shared/services/auth.service.ts` exchanges a Google ID token for a TrackIt app JWT.
  - `frontend/src/app/shared/interceptors/auth.interceptor.ts` sends `x-trackit-app-token`.
- Backend:
  - `api/src/functions/auth-login.ts` and `api/src/functions/auth-refresh.ts` require a Google ID token.
  - `api/src/shared/auth.ts` verifies Google ID tokens using Google JWKS and `GOOGLE_CLIENT_ID`.
  - `api/src/shared/authorize.ts` verifies TrackIt app JWTs signed with `JWT_SECRET`.
- Data model:
  - `users` documents are keyed by `sub`.
  - `userParticipantLinks.userId` also uses the current auth subject.
  - Existing user linkage is therefore coupled to the Google subject.

## Proposed Direction

Use a two-phase migration:

### Phase 1 - Clerk replaces Google as the identity provider, TrackIt app JWT stays

This is the lowest-risk product migration. The login boundary changes, but the protected API contract remains stable.

- Frontend signs in with Clerk instead of Google.
- Frontend sends a Clerk session token to `/api/auth/login`.
- Backend verifies the Clerk token, resolves the TrackIt user, and still returns a TrackIt app JWT.
- Protected API middleware continues to trust `x-trackit-app-token`.
- Phase 1 does not add silent renewal of the TrackIt app JWT. Expiry continues to behave as an authenticated-session boundary until Phase 2 removes the TrackIt JWT layer.

### Phase 2 - Remove the TrackIt app JWT and let the API trust Clerk directly

This is the cleanup phase that removes the double-token architecture.

- Frontend sends Clerk session tokens directly on protected API requests.
- Backend auth middleware verifies Clerk tokens directly.
- `/api/auth/login` and `/api/auth/refresh` are removed.
- `JWT_SECRET`, `JWT_AUDIENCE`, and TrackIt app-JWT signing code are retired.

### Phase 3 - Add machine-to-machine auth for scripts and tooling

This phase restores a first-class non-interactive auth story after the app has moved to direct Clerk-backed API auth.

- Add support for Clerk M2M tokens for approved automation and service-to-service callers.
- Keep interactive browser/user auth and machine auth as distinct flows with distinct authorization rules.
- Replace the legacy "non-Google auth for automation" backlog item with a Clerk-era machine-auth design only after this phase is specified and implemented.

## Key Decision: Fresh Start Instead of Existing-User Migration

The current schema uses the auth subject as both the `users` document key and the `userParticipantLinks.userId` partition key. In this plan, TrackIt does not migrate existing Google-linked users to Clerk-linked users.

Adopted policy for this backlog item:

1. Existing user accounts and links can be deleted before Clerk rollout.
2. Clerk-backed users will be created fresh in TrackIt on first successful login.
3. No Google-subject to Clerk-subject data migration is required.
4. Any environments that preserve existing user-linked data need a separate migration plan before Clerk cutover.

Recommended implementation choice for this backlog item:

- Keep `UserDocument.sub` as the Clerk subject for newly created users.
- Create new `users` documents and new `userParticipantLinks` records under Clerk identity only.
- Do not add transitional identity-mapping fields unless a preserved-data environment later requires them.

Scope note:

- Historical `createdByUserId` and `updatedByUserId` fields on domain documents do not currently drive authorization.
- If user-linked data is wiped before rollout, no historical Google-subject compatibility work is needed.

## Profile and Session Source of Truth

- Frontend `appUser` hydration should come from Clerk claims/session state, not from a TrackIt-issued JWT payload.
- TrackIt should still maintain a minimal local `users` mirror for backend reads that need display data such as member lists.
- The local mirror should include only the fields TrackIt actually needs, currently:
  - `sub`
  - `email`
  - `name`
  - `picture`
  - `roles`
- Normal synchronization pattern:
  - Clerk session claims drive current frontend auth state.
  - Clerk webhooks keep the local `users` mirror updated for backend reads.
  - Successful interactive login may also upsert the local user as a backstop in case webhook delivery lags.

## Documentation Impact

This migration changes canonical auth behavior, runtime configuration, some API auth wording, and operator workflows. The implementation should not rely on a generic "doc sweep" alone. The following docs need explicit review.

### Canonical docs that must be updated

- `docs/architecture/auth-flow.md`
  - Phase 1: replace Google login flow with Clerk login flow while documenting the temporary TrackIt app-JWT exchange.
  - Phase 2: rewrite the doc to describe direct Clerk-backed protected requests as the canonical auth model.
  - Update token sources, headers, login/logout behavior, and required environment variables.
- `docs/references/environment-variables.md`
  - Add Clerk frontend/backend variables for Phase 1.
  - Remove retired Google and TrackIt JWT variables in Phase 2.
- `AGENTS.md`
  - Remove `docs/backlog/non-google-auth-for-automation-and-agent-access.md` from the doc map when that backlog doc is deleted.

### Architecture docs that need targeted wording updates

- `docs/architecture/participant-association.md`
  - Replace "valid app JWT" wording with the current auth model.
  - Confirm the participant-link model description still matches the fresh-start Clerk identity assumption.
- `docs/architecture/data-modeling.md`
  - Update references to "app JWT admin authorization" where the direct Clerk model becomes canonical.
  - Confirm the `users` and `userParticipantLinks` descriptions still match the post-cutover identity model.
- `docs/architecture/api-conventions.md`
  - Review middleware/auth wording and examples so they no longer imply a TrackIt-issued app JWT if that is retired.

### Runbooks that need explicit review/update

- `docs/runbooks/api-testing.md`
  - Update route coverage expectations when `/api/auth/login` and `/api/auth/refresh` change or are removed.
  - Add guidance for Clerk auth tests and webhook tests if applicable.
- `docs/runbooks/common-dev-tasks.md`
  - Update auth-related endpoint guidance if local auth bootstrapping, webhook setup, or middleware expectations change.
- `docs/runbooks/frontend-build-verification.md`
  - Review whether login verification steps need Clerk-specific validation.

### Reference docs that need explicit review/update

- `docs/references/development-commands.md`
  - Review for any auth-related local setup commands or testing commands that change.
- `docs/references/repo-conventions.md`
  - Review for stale Google-specific examples or wording in auth-related examples.

### Product specs that need wording updates

- `docs/product-specs/behavior-tracking-abc.md`
  - Replace "valid app JWT" wording with the current auth model.
- Review other product specs for auth wording during the final doc sweep, even if no auth-specific lines are currently called out.

### Backlog docs that need explicit handling

- `docs/backlog/non-google-auth-for-automation-and-agent-access.md`
  - Keep until Phase 3 machine-auth guidance is implemented or fully superseded.
- Review remaining backlog docs for stale Google/app-JWT assumptions during the final sweep.

### New docs needed?

- New architecture doc: **not required by default**.
  - `docs/architecture/auth-flow.md` remains the canonical architecture doc for this work.
  - Add a new architecture doc only if Clerk webhook processing, user-mirror sync, and direct bearer-token authorization become complex enough that `auth-flow.md` would stop being readable.
- New product spec: **not required**.
  - This migration does not change product behavior in a way that needs a new product-spec document; it changes auth infrastructure and operator flows.
- New runbook: **possibly useful but optional**.
  - If Clerk local setup, webhook signing, or dashboard configuration turns out to be operationally non-trivial, add a small runbook such as `docs/runbooks/clerk-auth-setup.md`.
  - Do not create it preemptively unless implementation reveals repeated setup friction.
- New architecture doc for M2M auth: **not required by default**.
  - Prefer extending `docs/architecture/auth-flow.md` with a separate "machine auth" section.
  - Add a dedicated architecture doc only if human-user auth and M2M auth diverge enough to make `auth-flow.md` confusing.

## Phase 1 Checklist

### Clerk setup

- [ ] Create a Clerk application for TrackIt.
- [ ] Enable the intended sign-in methods in Clerk.
- [ ] Decide whether to keep Google as a Clerk social connection for user familiarity.
- [ ] Configure allowed origins and redirect URLs for local, staging, and production.
- [ ] Record required Clerk secrets and publishable keys in the deployment system.

### Frontend integration

- [ ] Add Clerk frontend SDK dependency.
- [ ] Remove the Google GIS script from `frontend/src/index.html`.
- [ ] Replace `googleClientId` in `frontend/src/environments/environment.ts` and `environment.prod.ts` with `clerkPublishableKey`.
- [ ] Introduce a Clerk bootstrap service to initialize ClerkJS once at app startup.
- [ ] Replace `GoogleIdentityService` usage in `frontend/src/app/shared/services/auth.service.ts`.
- [ ] Replace the Google button flow in `frontend/src/app/features/auth/login.component.ts` with a Clerk sign-in mount or custom Clerk-hosted flow.
- [ ] Preserve existing `returnUrl` behavior after successful login.
- [ ] Keep logout clearing TrackIt local state in Phase 1.
- [ ] On successful Clerk sign-in, fetch a Clerk session token and exchange it with `/api/auth/login`.
- [ ] Keep `frontend/src/app/shared/interceptors/auth.interceptor.ts` unchanged in Phase 1 so it still sends `x-trackit-app-token`.
- [ ] Remove Google-specific copy, comments, and error messages from the login flow.
- [ ] Change frontend `appUser` hydration to read from Clerk user/session claims rather than the TrackIt JWT response body.
- [ ] Decide the minimal frontend auth shape needed once Clerk is the source of truth for `sub`, `email`, `name`, and `picture`.

### Backend token exchange

- [ ] Add Clerk backend verification support in `api`.
- [ ] Replace Google-token verification in `api/src/shared/auth.ts` with Clerk session-token verification for login and refresh paths.
- [ ] Add Clerk configuration values to the auth config object.
- [ ] Remove `GOOGLE_CLIENT_ID` dependency from login and refresh code.
- [ ] Update `api/src/functions/auth-login.ts` to accept a Clerk token from request body or `Authorization` header.
- [ ] Update `api/src/functions/auth-refresh.ts` to accept a Clerk token instead of a Google token.
- [ ] Preserve TrackIt app JWT issuance in Phase 1.
- [ ] Preserve TrackIt role loading from Cosmos in Phase 1.
- [ ] Keep protected-route middleware unchanged in `api/src/shared/authorize.ts` for Phase 1.
- [ ] Return explicit error messages for missing or invalid Clerk tokens.
- [ ] Upsert the local `users` record from Clerk claims during login as a backstop for webhook lag.

### User creation and fresh-start assumptions

- [ ] Document the rollout assumption that existing Google-linked users and links are deleted before production cutover.
- [ ] Ensure first successful Clerk login can create a new TrackIt user without any migration prerequisite.
- [ ] Decide whether first successful Clerk login also auto-creates initial participant links or whether those are created only through onboarding flows.
- [ ] Document the expected behavior for a brand new Clerk user with no TrackIt data.
- [ ] Remove migration-specific code and checklist items from implementation once the fresh-start rollout decision is locked.

### Profile sync

- [ ] Add a Clerk webhook endpoint in `api` for user lifecycle sync.
- [ ] Handle `user.created` to create or update the local `users` record.
- [ ] Handle `user.updated` to refresh `email`, `name`, and `picture` in the local `users` record.
- [ ] Decide and document `user.deleted` behavior for local cleanup or deactivation.
- [ ] Verify webhook signature validation and error handling.
- [ ] Document webhook setup in local/dev and deployed environments.
- [ ] Ensure member-list and participant-sharing surfaces continue to read correct profile data from the local `users` mirror.

### Configuration and docs

- [ ] Add Clerk frontend and backend environment variables to `docs/references/environment-variables.md`.
- [ ] Update `docs/architecture/auth-flow.md` to describe Clerk in Phase 1.
- [ ] Update local dev setup docs if login bootstrapping changes.
- [ ] Remove Google-specific environment variable documentation once unused.
- [ ] Sweep docs for stale Google-login wording that is no longer true after Phase 1.
- [ ] Update `docs/architecture/participant-association.md` for the current auth model wording.
- [ ] Update `docs/architecture/data-modeling.md` anywhere it still assumes app-JWT admin authorization after cutover.
- [ ] Review `docs/architecture/api-conventions.md` for stale auth examples or wording.
- [ ] Review and update `docs/runbooks/api-testing.md` for Clerk auth coverage and retired auth routes.
- [ ] Review and update `docs/runbooks/common-dev-tasks.md` if Clerk setup changes implementation workflow.
- [ ] Review `docs/runbooks/frontend-build-verification.md` for login verification steps.
- [ ] Review `docs/references/development-commands.md` for auth-related command/setup changes.
- [ ] Review `docs/references/repo-conventions.md` for stale Google-auth examples.
- [ ] Update `docs/product-specs/behavior-tracking-abc.md` to remove app-JWT wording.
- [ ] Decide whether Clerk operational complexity warrants a dedicated runbook such as `docs/runbooks/clerk-auth-setup.md`.

### Tests

- [ ] Update unit tests for `auth-login` and `auth-refresh` to cover Clerk-token verification.
- [ ] Add tests for missing token, invalid token, and expired token behavior.
- [ ] Add tests for first-login user creation with a Clerk subject.
- [ ] Add tests for webhook-driven user profile sync.
- [ ] Verify protected endpoint tests still pass unchanged with TrackIt app JWT middleware.
- [ ] Add frontend tests for login redirect behavior and error handling.

### Rollout

- [ ] Deploy Clerk-backed login to a non-production environment first.
- [ ] Verify Clerk-backed first-login user creation in staging.
- [ ] Verify webhook delivery updates local user profile data correctly.
- [ ] Validate new-account provisioning behavior.
- [ ] Delete or reset old Google-linked users before production cutover.
- [ ] Cut production over only after staging sign-off on fresh-start behavior.
- [ ] Keep a rollback path that re-enables Google-backed login until Clerk login is proven stable.

## Phase 1 Acceptance Criteria

- Users can sign in through Clerk and reach authenticated screens.
- Existing protected API calls continue working without modifying protected endpoint middleware.
- New users provision correctly from Clerk-backed login and onboarding flows.
- Google-specific frontend code and config are no longer required for interactive login.
- Frontend `appUser` state is hydrated from Clerk claims/session data.
- Local user profile data stays in sync via Clerk webhooks plus login backstop upserts.

## Phase 2 Checklist

### Frontend request model

- [ ] Change the frontend auth state model so it no longer stores a TrackIt app JWT.
- [ ] Replace `x-trackit-app-token` injection in `frontend/src/app/shared/interceptors/auth.interceptor.ts` with `Authorization: Bearer <clerk_session_token>`.
- [ ] Fetch Clerk session tokens on demand rather than persisting a separate TrackIt token in local storage.
- [ ] Update logout to rely on Clerk sign-out plus local TrackIt state cleanup.
- [ ] Remove TrackIt token-expiry timers from `frontend/src/app/shared/services/auth.service.ts`.
- [ ] Ensure route guards derive auth state from Clerk session state, not TrackIt JWT validity.
- [ ] Keep Clerk claims/session as the source of truth for frontend `appUser` hydration.

### Backend protected-route auth

- [ ] Replace `api/src/shared/authorize.ts` so it validates Clerk session tokens directly.
- [ ] Read Clerk session tokens from the `Authorization` header for cross-origin requests.
- [ ] Validate issuer, signature, expiry, and authorized parties.
- [ ] Map Clerk claims to the internal user context expected by middleware and handlers.
- [ ] Decide whether user roles remain loaded from Cosmos on each request or are cached in Clerk claims.
- [ ] Keep role enforcement behavior unchanged even if the token source changes.

### Remove TrackIt app JWT infrastructure

- [ ] Delete `signAppJwt()` usage and remove TrackIt app-JWT issuance.
- [ ] Delete `/api/auth/login` once no clients use it.
- [ ] Delete `/api/auth/refresh` once no clients use it.
- [ ] Remove `JWT_SECRET`, `JWT_AUDIENCE`, and `JWT_EXPIRY_SECONDS` from runtime configuration when fully unused.
- [ ] Remove app-JWT-specific tests and docs.
- [ ] Remove any code paths that assume `x-trackit-app-token`.
- [ ] Sweep the repo for stale `google`, `Google`, `GOOGLE_CLIENT_ID`, `jwt`, `JWT_SECRET`, `JWT_AUDIENCE`, `JWT_EXPIRY_SECONDS`, and `x-trackit-app-token` references and remove or rewrite them.

### Docs and cleanup

- [ ] Rewrite `docs/architecture/auth-flow.md` to describe the direct Clerk model as the canonical flow.
- [ ] Update `docs/references/environment-variables.md` to remove retired TrackIt JWT variables if no longer used anywhere.
- [ ] Remove obsolete Google and app-JWT comments from frontend and backend code.
- [ ] Remove stale Google and app-JWT references from runbooks, backlog docs, product specs, and architecture docs.
- [ ] Verify the explicit documentation-impact file list in this doc has been completed, not just spot-checked.
- [ ] Keep `docs/backlog/non-google-auth-for-automation-and-agent-access.md` until Phase 3 machine-auth support is complete or its requirements have been fully merged into canonical docs.

### Tests

- [ ] Add direct protected-route auth tests using Clerk session tokens.
- [ ] Add tests that verify missing `Authorization` headers fail with `401`.
- [ ] Add tests that verify invalid `azp` or issuer claims fail.
- [ ] Add tests that verify participant middleware still authorizes the correct linked user.
- [ ] Add frontend tests that verify authenticated requests still work after browser refresh.
- [ ] Add tests that verify frontend hydration from Clerk claims still provides the user fields required by current UI surfaces.

### Rollout

- [ ] Ship Phase 2 only after Phase 1 has been stable in production long enough to trust the identity migration.
- [ ] Temporarily support both TrackIt app JWT and Clerk bearer token on the backend during the cutover if needed.
- [ ] Remove dual support only after clients are fully upgraded.

## Phase 2 Acceptance Criteria

- Protected API requests succeed using Clerk session tokens directly.
- TrackIt no longer issues or verifies its own app JWTs.
- `/api/auth/login` and `/api/auth/refresh` are retired.
- Frontend auth state is driven by Clerk session state only.
- The repo no longer contains stale Google-login or retired TrackIt app-JWT references except in intentional historical context.

## Phase 3 Checklist

### Machine-auth design

- [ ] Confirm Clerk M2M tokens are the chosen non-interactive auth mechanism for scripts and tooling.
- [ ] Define which callers are allowed to use M2M auth:
  - [ ] internal automation
  - [ ] CI jobs
  - [ ] local agent tooling
  - [ ] external integrations, if any
- [ ] Define the authorization model for M2M callers:
  - [ ] global admin-style access
  - [ ] scoped service roles
  - [ ] participant-scoped access, if needed
- [ ] Keep machine-auth authorization distinct from human-user participant-link authorization.

### Backend support

- [ ] Add backend verification support for Clerk M2M tokens.
- [ ] Decide whether M2M tokens are accepted on the same protected routes or only on an explicit subset.
- [ ] Add middleware or branching logic that can distinguish user session tokens from M2M tokens safely.
- [ ] Define the internal auth context shape for M2M callers.
- [ ] Ensure admin-only endpoints do not accidentally trust all M2M callers by default.
- [ ] Add clear unauthorized/forbidden error behavior for invalid or under-scoped M2M callers.

### Tooling and operational flow

- [ ] Define how local scripts and agents obtain M2M tokens in development.
- [ ] Define how CI/staging/production automation obtains M2M tokens securely.
- [ ] Document secret storage and rotation requirements.
- [ ] Decide whether local/staging agent access should use the same M2M flow or a separate bootstrap shortcut.

### Documentation

- [ ] Extend `docs/architecture/auth-flow.md` with a machine-auth section once the design is stable.
- [ ] Update `docs/references/environment-variables.md` with any M2M-specific variables or secrets.
- [ ] Add or update a runbook for machine-auth setup if operational steps are non-trivial.
- [ ] Replace or delete `docs/backlog/non-google-auth-for-automation-and-agent-access.md` only after its requirements are fully covered by the Clerk-era design.
- [ ] Remove the deleted or superseded backlog doc from `AGENTS.md` in the same change.

### Tests

- [ ] Add tests for valid M2M token authorization.
- [ ] Add tests for invalid token type, missing scopes, and forbidden route access.
- [ ] Add tests that verify human-user-only participant routes do not accidentally accept an M2M identity without explicit support.

### Rollout

- [ ] Enable M2M auth in non-production first.
- [ ] Validate at least one real script/tooling workflow end to end.
- [ ] Validate CI or agent-driven exploration flow if that is an intended consumer.
- [ ] Cut over any remaining script/tooling guidance from the legacy backlog item only after successful validation.

## Phase 3 Acceptance Criteria

- Non-interactive scripts and tooling can obtain Clerk-backed machine tokens and call the intended API routes.
- Human-user auth and machine auth remain clearly separated in authorization logic.
- Tooling/auth guidance no longer depends on the legacy Google/app-JWT assumptions.
- `docs/backlog/non-google-auth-for-automation-and-agent-access.md` is either removed or explicitly superseded by canonical Clerk-era machine-auth documentation.

## Risks and Open Questions

- Should Phase 1 use Clerk-hosted UI components or a custom login screen backed by ClerkJS?
- Should TrackIt keep Google enabled as a social provider inside Clerk for continuity?
- Should Phase 2 continue loading roles from Cosmos, or should role claims move into Clerk session customization?
- Should local user-profile sync rely only on Clerk webhooks, or should login upserts remain permanently as a defensive backstop?
- Do any preserved-data environments still need a subject-migration plan even if production does not?
- Which API routes should accept Clerk M2M tokens in Phase 3, and what scopes/roles should they require?

## Related Docs

- `docs/architecture/auth-flow.md`
- `docs/references/environment-variables.md`
- `docs/backlog/non-google-auth-for-automation-and-agent-access.md`
