# TrackIt Implementation Plan

Last updated: 2026-03-22

---

# Pending

## Architecture Specification Compliance (Iteration 1 Analysis)

### Build Phase Checklist: Data Modeling Timestamp Naming

**Issue**: ParticipantDocument, UserParticipantLinkDocument, and UserDocument use `createdAt` and `lastLoginAt` instead of the specification-required `*AtUtc` suffix for UTC timestamps.

**Specification Reference**: `docs/architecture/data-modeling.md` lines 47-49:
> Use `*AtUtc` for UTC instants stored as ISO 8601 strings ending with `Z`. Examples: `createdAtUtc`, `updatedAtUtc`, `archivedAtUtc`, `occurredAtUtc`, `eventAtUtc`.

**Violations Identified**:
- [ ] **api/src/models/participant.ts** (lines 9, 21): Rename `createdAt` → `createdAtUtc`
- [ ] **api/src/models/user.ts** (lines 12, 13): Rename `createdAt` → `createdAtUtc`, `lastLoginAt` → `lastLoginAtUtc`

**Code Impact Analysis**:
- [ ] Check all usages of `createdAt` in participant.ts and user.ts across codebase
- [ ] Update type definitions in api/src/models/
- [ ] Update all read/write paths in api/src/functions/ that reference these fields
- [ ] Update frontend types in frontend/src/app/shared/models/ if they mirror backend models
- [ ] Consider database migration strategy (dual-read during rollout per spec guidance)

**Test Requirements**:
- [ ] Verify participant creation still stores timestamp correctly as ISO 8601 UTC string
- [ ] Verify user creation/login still stores timestamp correctly as ISO 8601 UTC string
- [ ] Existing tests that check these fields still pass with renamed properties
- [ ] API responses correctly serialize renamed fields

**Acceptance Criteria**:
- [ ] All UTC timestamp fields in Participant, User, and UserParticipantLink documents use `*AtUtc` suffix
- [ ] Naming is consistent across all domain models (matches BehaviorIncidentDocument, DailyReflectionDocument, MedicationLogDocument, MedicationDocument)
- [ ] All read/write paths updated; no stray `createdAt` references to these fields
- [ ] Tests pass; no 5xx errors from serialization issues
- [ ] Build passes

---

### Specification Enhancement Recommendations

**Diagrams to Add** (to improve spec clarity and readability):

1. **docs/architecture/auth-flow.md** — Add Mermaid sequence diagram:
   - Frontend login flow (ClerkService → hosted UI → session token)
   - Request flow (frontend → authInterceptor → x-trackit-app-token header → API authorize())
   - Token validation (verifyClerkSessionToken → ResolvedClerkClaims → request state)
   - Return URL handling on 401

2. **docs/architecture/page-shell.md** — Add ASCII layout diagram:
   ```
   ╔═══════════════════════════════════════════════════════════╗
   │ TopBar (sticky, z:30, bg-white/90, border-b)             │
   ╠═══════════════════════════════════════════════════════════╣
   │                                                             │
   │                    Main (overflow-y: auto)                 │
   │                    [page component outlet]                 │
   │                                                             │
   │   [padding-bottom: calc(5rem + safe-area-inset)]         │
   │                                                             │
   ╠═══════════════════════════════════════════════════════════╣
   │ BottomNav (fixed, z:50, bg-white/95, border-t)           │
   ║ 📊 Insights | 📅 Timeline | ⚙️ Profile                    ║
   ╚═══════════════════════════════════════════════════════════╝

   BottomSheet (z:1000, max-height: 85vh, top-radius: 1.5rem)
   appears above this layout
   ```

3. **docs/architecture/data-modeling.md** — Add container relationship diagram:
   ```
   Cosmos DB Containers & Relationships:

   users (partition: /id)
       ↓
   userParticipantLinks (partition: /userId)
       ↓
   participants (partition: /id)
       ├→ behaviorIncidents (partition: /participantId)
       ├→ medications (partition: /participantId)
       ├→ medicationLogs (partition: /participantId)
       ├→ dailyReflections (partition: /participantId)
       └→ eventIndex (partition: /participantId)
           [projected read model across all domains]

   Timestamp Field Naming Convention:
   - UTC timestamps: *AtUtc (e.g., createdAtUtc, updatedAtUtc)
   - Date-only values: *DateUtc or logLocalDate (e.g., logLocalDate: YYYY-MM-DD)
   - Local time: logLocalTime (HH:mm) + logTzOffsetMinutes (±minutes)
   ```

---

### Compliance Summary

**Overall Status**: MOSTLY COMPLIANT (1 high-severity issue identified)

**Areas Fully Compliant** ✓:
- Frontend engineering conventions (standalone components, OnPush, signals, inline templates, inject())
- API conventions (composeHttpHandler, middleware order, parseJsonBody, validation errors, kebab-case)
- Auth implementation (Clerk token handling, x-trackit-app-token header, computed signal auth state, no legacy endpoints)
- Page shell (TopBar/BottomNav z-index layering, scroll container, routing structure, bottom nav clearance)
- Participant association (manager link auto-creation, role tracking, access enforcement via middleware)

**Areas Requiring Action** ⚠️:
- Data modeling timestamp naming (3 documents use `createdAt` instead of `createdAtUtc`)

---


# Completed

- [x] **ralph-loop-migration.md** — All phases complete. `docs/product-specs/insights-dashboard.md` created; `medication-command-center.md`, `behavior-tracking-abc.md`, `daily-reflection-scoring.md` updated with merged content; `PROMPT_plan.md`, `PROMPT_build.md`, `AGENTS.md`, `development-commands.md`, `common-dev-tasks.md` updated to use `docs/**/*.md` knowledge base and `IMPLEMENTATION_PLAN.md` scope; `docs/specs/` directory deleted.

- [x] **Phase 1c: Merge `daily-reflection-2.md` into `daily-reflection-scoring.md`** (ralph-loop-migration.md). Updated `docs/product-specs/daily-reflection-scoring.md`: Section 5 "Ambiguous Input" replaced "Default selection is the middle bucket (bucket 3), visually pre-selected" with the null score commitment model (Balanced visually suggested but no dimension committed; first tap commits; untouched → `null`; zero-committed save blocked with validation; PUT body sends `null` for cleared dimensions, omits untouched new-form dimensions). US-DR-001 acceptance criteria replaced "Balanced is pre-selected as default" with the full commitment model criteria.

- [x] **Phase 1b: Merge `behavior-incidents-2.md` into `behavior-tracking-abc.md`** (ralph-loop-migration.md). Updated `docs/product-specs/behavior-tracking-abc.md`: API Surface auth changed from "valid app JWT" to Clerk session token; list-view row format (date/time, ABC summary line, function label) documented; detail view (A/B/C, place, function, date/time; Edit and Delete with confirmation) documented; `startDate`/`endDate` filter note added (not `fromUtc`/`toUtc`).

- [x] **Phase 1a: Merge `medications-summary-2.md` into `medication-command-center.md`** (ralph-loop-migration.md). Expanded the Medications `/medications` section summary card bullet in `medication-command-center.md` to explicitly state the interval adherence logic: `due`/`overdue` items counted in remaining alongside scheduled pending doses; `early` items excluded; copy semantics ("All on track" / "N remaining" / "None scheduled"); nearest-interval guidance lines. Previously the spec only said "same adherence language as Insights" without stating the rules.

- [x] **Bug: Stale API tests from clerk-auth-3 migration** — Deleted `auth-login.test.ts` and `auth-refresh.test.ts` (handlers were removed in clerk-auth-3). Updated `admin-event-index-migrations.test.ts` mock format from `{ roles: ['admin'] }` to `{ metadata: { roles: ['admin'] } }` to match new `ResolvedClerkClaims` shape. All 174 tests now pass. `api-testing.md` baseline updated to 23 files / 174 tests.

- [x] **Priority 1** — Architecture: Clerk Direct Token Verification (clerk-auth-3.md). `authorize.ts` rewritten to verify `Authorization: Bearer <clerk-token>` via `verifyClerkSessionToken()`. `ResolvedClerkClaims` type added; `AppJwtPayload`/`AppUserClaims`/`signAppJwt` removed. `admin.ts` checks `metadata.roles`. Middleware updated to `await authorize()`. `auth-login.ts` and `auth-refresh.ts` deleted. Frontend `AuthService` simplified: no localStorage, no JWT timer, `isAuthenticated` derived from `clerk.sessionId()`. `ClerkService` exposes `userName`/`userEmail`/`userPicture` signals. `authInterceptor` sets `Authorization: Bearer` via `clerk.getSessionToken()`. Tools updated to `Authorization: Bearer`. TypeScript builds verified clean for both frontend and API.
- [x] **Priority 2** — Bug: Invite Accept Post-Acceptance Redirect (invite-accept-redirect.md). `InviteAcceptComponent` `setActiveAndGo()` changed from `router.navigate(['/home'])` to `router.navigate(['/insights'])`. Error-state `routerLink` also changed from `/home` to `/insights`. Button labels updated to "go to Insights". TypeScript build verified clean.

- [x] **clerk-auth-1.md** — Clerk frontend login: `ClerkService` + `LoginComponent` with Clerk widget implemented. Confirmed by git commit `feat(login): use clerk`.
- [x] **Priority 1** — Bug: Behavior Incident Filter Contract (behavior-incidents-2.md)
- [x] **Priority 2** — Bug: Daily Reflection Null-Score Defaults (daily-reflection-2.md)
- [x] **Priority 3** — Missing Feature: Medications Summary Card Interval Support (medications-summary-2.md)
- [x] **Priority 4** — Missing Feature: Today's Reflection Card on Insights (insights-today-reflection.md)
- [x] **Priority 5** — Missing Routes: Incident List, Detail, and New (behavior-incidents-2.md)
- [x] **Priority 6** — Documentation: Align Product Spec with API Contract (behavior-incidents-2.md)
- [x] **Priority 7** — Feature: Viewer Role UI Differentiation (docs/backlog/multi-caregiver-mvp.md item 3). Profile page hides Edit button and medication Add/Edit/Archive controls for viewers; shows "Only managers can add or edit medications." note. TypeScript build verified clean.
- [x] **Priority 8** — Bug: Top Bar Touch Targets (top-bar-touch-targets.md). `.icon-button` changed from `width/height: 2.25rem` (36px) to `min-width/min-height: 2.75rem` (44px). Docs updated.
- [x] **Priority 2** — Architecture: Shell Viewport Normalization (shell-viewport-normalization.md). `ShellComponent` `:host` and `.shell` changed from `min-height: 100dvh` to `height: 100dvh; overflow: hidden`. `<main>` now has `overflow-y: auto`. All five affected screens verified — none set fixed heights on `:host`. Docs updated.
- [x] **Priority 3** — Bug: Daily Reflection Layout Clipping (daily-reflection-layout.md). `:host` set to `height: 100%`; `.page` made flex column (`height: 100%; display: flex; flex-direction: column`); `.cards` given `flex: 1; min-height: 0; overflow-y: auto` so cards scroll while action bar stays visible below. TypeScript build verified clean.
- [x] **Priority 3** — UX: Profile Caregiver Action Hierarchy (profile-caregiver-action-hierarchy.md). "Copy Invite Link" is now the primary filled violet pill CTA. "Share" is a secondary ghost-violet button. "Regenerate link" is a de-emphasized text link below primary actions. "Generate Invite Link" is the primary CTA when no invite exists. Regenerate removed from card header. TypeScript build verified clean.
- [x] **Priority 4** — Feature: Medications Dashboard Workflow (medications-dashboard-workflow.md). Template reordered: Scheduled → As-Needed → Summary card. Summary card moved to bottom with de-emphasized styling (gray background, no drop shadow, 2rem top margin). As-needed card header now shows "Last taken: HH:MM" or "No doses today". Interval medication cards already had Last logged / Next due labels. TypeScript build verified clean.
- [x] **Priority 5** — UX: Behavioral Moment Create Form Density (behavioral-moment-create-form.md). Textarea moved above chip-selector in all three A/B/C sections; "Quick tags" label added to make chips visually subordinate. Function buttons changed from column to row layout (reducing height from ~64px to ~44px per button, saving ~40px total). `.notes` margin-top set to 0. TypeScript build verified clean.
- [x] **Multi-Caregiver MVP Item 4** — Invite Link Context (multi-caregiver-mvp.md item 4). `shareInviteLink()` in `profile-dashboard.component.ts` now reads `this.participant()?.displayName` and injects the participant's name into both the Web Share title (`TrackIt — {name}'s caregiver invite`) and body text (`Join me in tracking {name} on TrackIt.`). Falls back to `"your child"` when display name is absent. TypeScript build verified clean.
- [x] **Multi-Caregiver MVP Item 1** — Members List and Revoke Access UI (multi-caregiver-mvp.md item 1). Already implemented: `profile-dashboard.component.ts` renders a "Who has access" section (manager-only) listing all linked caregivers by name/role, shows "(you)" badge on self, provides per-member Revoke button with inline confirm/cancel flow, and reloads the list after successful revoke. Viewer role sees no member list or revoke controls.
- [x] **Multi-Caregiver MVP Item 2** — Participant Setup for New Users (multi-caregiver-mvp.md item 2). Already implemented: `/setup` route with `ParticipantSetupComponent` (3-step wizard: welcome → participant form → optional medication → success). `ActiveParticipantGuard` redirects to `/setup` when user has 0 linked participants; auto-selects single participant when exactly 1 is found. Invited users who already have a linked participant are never redirected to setup.
- [x] **FCM-A4** — Formatting Utilities Consolidation. `formatLocalDate(date: Date): string` and `formatTimeLabel(value: string | undefined, fallback?: string): string` extracted to `shared/utils/datetime.ts`. Private duplicate methods removed from `insights-dashboard`, `medications-dashboard`, `daily-reflection`, and `timeline` components (4 copies of `formatLocalDate`, 3 copies of `formatTimeLabel`, 1 `todayDateOnly` helper). TypeScript build verified clean.
- [x] **Timeline: Incident Cards Tappable** — Added `incident` to `entry-tappable` class condition and added `incident` case to `onCardTap` in `timeline.component.ts` that navigates to `/incidents/:sourceId`. Per the timeline-day-browser spec, all event card types should be tappable to open for editing. TypeScript build verified clean.
- [x] **Timeline: Log Behavior Incident in Quick-Add Menu** — Added "Log behavior incident" button (icon: `priority_high`) to the timeline day quick-add menu in `timeline.component.ts`. Added `logIncident(date)` method navigating to `/incidents/new?date=YYYY-MM-DD`. Also added `date` query param support to `behavioral-moment-create.component.ts`: reads `?date` param to pre-fill `occurredAt`, shows a green date-context banner ("Logging for Wednesday, Mar 18") for past dates (consistent with daily-reflection pattern). TypeScript build verified clean.
