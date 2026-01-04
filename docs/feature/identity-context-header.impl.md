# Implementation Plan: Identity + Context Header

## Scope Recap
- Show signed-in user identity (name + optional avatar/email fallback).
- Show active participant (name + age) in a sub-header beneath the main header.
- Provide a “Switch participant” link.
- Handle empty/unknown active participant state.
- Hide context on auth pages.

## Assumptions / Open Questions
- Use existing app JWT/user profile from `AuthService`.
- Active participant context can be resolved from the stored active participant id.
- No new backend models required; reuse existing participant endpoints.

## Technical Plan
### Data Model Changes
- None (reuse `Participant` and active participant id in localStorage).

### API Shape and Endpoints
- Reuse existing endpoints:
  - `GET /api/participants/{id}` for active participant details.

### Frontend/UI Changes
Create a dedicated context bar component and place it below the primary header.

**New components**
- `ContextBarComponent` (standalone):
  - Reads user identity from `AuthService`.
  - Reads active participant id from `ParticipantService`.
  - Fetches participant details via `httpResource` (or `ParticipantService` method) when active id exists.
  - Shows:
    - User label (name or email fallback) + optional avatar if available.
    - “Tracking: {participant} (Age {age})”.
    - “Switch participant” link to `/participants`.
  - Empty state:
    - “No active participant selected” + “Select participant” link.

**Placement**
- `app.component.html`: insert context bar below the main header.

**Visibility rules**
- Hide on auth pages (e.g., `/login`).
- Still show on `/participants` page for orientation.

**Styling**
- Use existing tokens (`--space-*`, `--color-text-muted`, `--color-primary`).
- Keep sub-header visually lighter than the primary header.

### Validation + Auth
- Context bar only appears when authenticated.
- Only fetch participant details when an active participant id exists.

### Testing Approach
Frontend:
- Shows user identity with name/email fallback.
- Shows active participant when id exists.
- Shows empty state when no active participant.
- Hides on `/login`.
- “Switch participant” link routes to `/participants`.

API:
- No new endpoints.

## Sequencing
1. Add `ContextBarComponent` with user + participant display logic.
2. Integrate into `app.component.html` below main header.
3. Wire hide-on-auth-page behavior.
4. Add minimal UI styling.
5. Manual QA on authenticated routes and `/login`.

## Story-Tracking Checklist
- [x] Story 1: Signed-in user identity visible.
  - [x] Render user name with email fallback.
  - [x] Optional avatar if present.
- [x] Story 2: Active participant context visible.
  - [x] Fetch and display participant name + age when active.
  - [x] Show empty state when none selected.
- [x] Story 3: Switch participant affordance.
  - [x] “Switch participant” link to `/participants`.
  - [x] Hide context bar on auth pages.
