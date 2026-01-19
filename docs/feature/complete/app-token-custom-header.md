# Feature Spec: App Auth Token via Custom Header (SWA-Safe)

## Feature Summary
- Problem / why now: When deployed behind Azure Static Web Apps (SWA), some `/api/*` requests can fail even after a successful login, because the platform/proxy layer may interfere with the `Authorization` header before the request reaches the Functions backend. This shows up as intermittent or persistent API failures (e.g., “invalid signature”) despite the app appearing to send the correct token.
- Primary users: Parents/caregivers using the deployed TrackIt web app; developers deploying TrackIt to SWA.
- Desired outcome: Authenticated API calls work reliably in SWA by moving the TrackIt app JWT transport away from the `Authorization` header to a TrackIt-specific custom header.

## Rollout / Scope
- MVP in scope:
  - TrackIt app JWT (the token used for normal authenticated `/api/*` calls) is sent via a custom header (e.g., `x-trackit-app-token`) instead of `Authorization`.
  - The Functions backend accepts the custom header for authentication and treats failures as `401` (not `500`) with clear, safe error messages.
- Out of scope:
- Phasing / rollout notes (optional):
- Out of scope:
  - Changing identity provider (Google) or switching to SWA built-in auth.
  - Replacing tokens with cookies / server sessions (potential future enhancement).
  - Any changes to the Google login exchange beyond what’s needed to keep the flow working.
  - Backward compatibility / transitional dual-support for `Authorization: Bearer <appJwt>` (this is a hobby project; we’ll just switch).

## User Stories
1. As a parent, I can log in and use TrackIt in the deployed SWA site without API errors.
2. As a developer, TrackIt authentication works reliably when deployed behind SWA without needing special proxy workarounds.
3. As a developer, I can roll out this change safely without breaking local development workflows.

## User Story Details
### 1) Reliable authenticated API calls in SWA
**User story**  
As a parent, I can log in and use TrackIt in the deployed SWA site without API errors.

**Important data flows and validations**
- After login, the frontend includes the TrackIt app JWT on subsequent `/api/*` calls using the custom header.
- The backend validates the app JWT and returns `401` for invalid/missing tokens.

**Acceptance criteria**
- After a successful login on SWA, key authenticated API calls (e.g., listing participants) succeed consistently.
- If the token is missing/invalid, API returns `401` (not `500`) with a clear message.
- No user-visible UI changes are required.

**UX notes**
- No new screens.
- Error messaging should remain user-friendly (e.g., “Session expired, please sign in again”) if surfaced.

### 2) Robustness across hosting/proxies
**User story**  
As a developer, TrackIt authentication works reliably when deployed behind SWA without needing special proxy workarounds.

**Important data flows and validations**
- The app JWT is not sent via `Authorization` to avoid platform-level header handling.
- The chosen header name is stable and documented.

**Acceptance criteria**
- The deployed SWA site does not depend on the `Authorization` header for normal app JWT auth.
- The header name and behavior are documented for troubleshooting.

**UX notes**
- Not user-facing; developer-facing documentation only.

### 3) Safe rollout and local compatibility
**User story**  
As a developer, I can roll out this change safely without breaking local development workflows.

**Important data flows and validations**
- Existing saved sessions may become invalid and require re-login after this change.

**Acceptance criteria**
- Local dev continues to work (or has a clear, minimal migration step).
- If a user has an older stored session, the app handles it cleanly (e.g., prompts re-login).

**UX notes**
- If needed, the login page can show a short “Please sign in again” message after an upgrade.

## Open Questions
- Header name: `x-trackit-app-token` vs `x-trackit-authorization` vs `x-trackit-jwt`.
- Should the app JWT be sent only to same-origin `/api/*` calls (recommended), and should the client guard against accidentally sending it cross-origin?
- Do we want to add a lightweight “auth diagnostics” mode (dev-only) to help confirm which headers the backend received?

## Decisions (optional)
- We will make a hard switch: app JWT is transported via a custom header, not `Authorization`.

## Technical Considerations (optional)
- SWA/proxy layers may treat `Authorization` specially (inject/strip/override) for platform auth, which can corrupt app-level JWT verification.
- A custom header avoids collisions with platform auth mechanisms while keeping the app stateless.
- Ensure responses do not log or return token contents; only return safe, actionable error messages.

## Completion Notes
- `npm run build:api` passes locally after the change.
- SWA logs for `/api/participants?pageSize=50` now show requests authenticated via `x-trackit-app-token` instead of `Authorization`.
