# Frontend Component Modularization Plan

Status: Ready to implement iteratively
Last updated: 2026-03-08

## Overview

Several screen components currently own too much template, style, and state logic in one file. This increases regression risk, slows reviews, and makes targeted UI changes expensive.

Current hotspot sizes:

- `frontend/src/app/features/medications/medications-dashboard.component.ts` (~1524 lines)
- `frontend/src/app/features/insights/insights-dashboard.component.ts` (~1148 lines)
- `frontend/src/app/features/profile/profile-dashboard.component.ts` (~892 lines)
- `frontend/src/app/features/timeline/timeline.component.ts` (~684 lines)
- `frontend/src/app/features/incidents/behavioral-moment-create.component.ts` (~626 lines)
- `frontend/src/app/features/daily-reflection/daily-reflection.component.ts` (~579 lines)

This backlog item defines a phased refactor to break pages into smaller feature sub-components and extract repeated UI/data patterns into shared components and utilities.

## Scope

In scope:

- Split large page components into smaller, focused sub-components.
- Extract repeated UI patterns across features into shared UI components.
- Extract repeated formatting and summary logic into shared utilities/services.
- Keep behavior and UX unchanged unless explicitly listed in a child task.

Out of scope:

- Visual redesign or IA changes.
- Route structure changes.
- API contract changes.
- Rewriting all feature state management in one pass.

## Refactor principles

1. Preserve behavior first, then improve structure.
2. Keep each refactor slice reviewable (target: <= ~300 lines changed per PR where possible).
3. Move shared logic only after the second concrete usage.
4. Prefer presentational sub-components with explicit `input()`/`output()` contracts.
5. Keep component templates/styles inline per current frontend conventions.

## Reuse opportunities to extract

### Cross-page findings (Profile + Incident form + Daily Reflection, Mar 2026)

Candidates to extract now (confirmed in Pencil + Angular templates):

1. **Tinted card base** (shared shell with tone variants)
   - Proposed: `app-tone-card` (`tone`, `padding`, `headerSlot`, `bodySlot`)
2. **Card header pattern** (title + optional trailing action)
   - Proposed: `app-card-header`
3. **Labeled value stack** (uppercase label + value)
   - Proposed: `app-labeled-value`
4. **Action pill + row** (save/cancel/copy/share style clusters)
   - Proposed: `app-action-pill` + `app-action-row`
5. **Chip pill visual token** (selected/unselected shell only)
   - Proposed: `app-chip-pill`
6. **Labeled field shell for inputs/textarea**
   - Proposed: `app-labeled-field` (supports input/select/textarea slot)
7. **Bucket option row pattern** (title + supporting copy + selected state treatment)
   - Proposed: `app-bucket-option`
8. **Reflection facet card scaffold** (facet title/icon + bucket list + optional hint)
   - Proposed: `app-reflection-facet-card` (built on `app-tone-card`)

Keep feature-local for now:

1. Incident `abc-section-card` behavior (badge semantics + chip-selector wiring).
2. Profile member/medication row logic (role/revoke/archive states and conditional actions).
3. Reflection scoring semantics and facet-specific bucket mappings (Mood/Focus/Energy/Sleep labels and defaults).

### UI component patterns

1. **Page intro block** (`title` / `hero` / `page-head` variants across Insights, Profile, Daily Reflection, Timeline, Incidents)
   - Proposed: `app-page-intro` (`title`, `subtitle`, optional trailing action slot)
2. **Section container + heading + optional action/link** (`section`, `card`, `section-header`, `card-header`)
   - Proposed: `app-section-card`
3. **Standard async feedback blocks** (`loading`, `error`, `empty`, `muted/status`)
   - Proposed: `app-resource-state`
4. **Loading placeholders / shimmer states**
   - Proposed: `app-skeleton` (replace ad-hoc page-local loading placeholders where layout skeletons are known)
5. **Pill/button action row** (Save/Cancel, Copy/Share, inline action clusters)
   - Proposed: `app-action-row`
6. **Medication adherence ring summary** (duplicated between Insights and Medications)
   - Proposed: `app-medication-adherence-summary-card`
7. **Tinted section cards with consistent radius/stroke/shadow**
   - Proposed: `app-tone-card` (`sky`, `violet`, `emerald`, `amber`, `neutral`)
8. **Card header with optional trailing action**
   - Proposed: `app-card-header`
9. **Labeled value field block** (uppercase metadata label + value text)
   - Proposed: `app-labeled-value`
10. **Shared input/textarea shell**
   - Proposed: `app-labeled-field`
11. **Bucket option list row**
   - Proposed: `app-bucket-option`
12. **Reflection facet card scaffold**
   - Proposed: `app-reflection-facet-card`

### Shared utility/service patterns

1. **Date/time formatting duplication**
   - Current duplicates: `formatLocalDate`, `formatTimeLabel` in Insights, Medications, Timeline, Daily Reflection
   - Proposed: `shared/utils/formatting.ts` (+ unit tests)
2. **Medication due/adherence summary duplication**
   - Current overlap in Insights and Medications (`medicationSummary`, `progressDasharray`, interval due logic)
   - Proposed: `shared/services/medication-adherence.service.ts` (pure computation helpers)
3. **Feature-local UI state bloat from many `signal()` fields**
   - Proposed: feature-local state files (`features/*/state/*.ts`) for complex pages only

## Work packages (phased backlog)

### Phase 0: Guardrails and baseline

- [ ] Add refactor baseline notes for each targeted page (current responsibilities and extraction boundaries).
- [ ] Add/expand unit tests for high-risk pure logic before moving code (especially medication summaries and date/time formatting).
- [ ] Define a "no behavior drift" checklist used in every refactor PR.

### Phase 1: Shared foundation extraction

- [ ] Create `app-page-intro` and adopt it in one low-risk page first (Timeline or Daily Reflection).
- [ ] Create `app-section-card` for heading/body/action composition.
- [ ] Create `app-tone-card` and `app-card-header` for tinted card sections with action affordances.
- [ ] Create `app-labeled-value` and `app-labeled-field` primitives.
- [ ] Create `app-resource-state` for loading/error/empty blocks.
- [ ] Adopt `app-skeleton` for structured loading states (start with Insights metrics grid, then Profile and Daily Reflection card loads).
- [ ] Create formatting helpers in `shared/utils/formatting.ts` and replace duplicate local helpers.
- [ ] Update `shared/ui/index.ts` exports and add usage docs/comments.

### Phase 2: Insights + Medications (highest leverage first)

- [ ] Extract Insights into sub-components:
  - `weekly-rhythms-card-grid`
  - `medication-summary-card`
  - `behavior-moment-preview-card`
  - `quick-action-entry-card` (Daily Reflection / Log a Moment)
- [ ] Extract Medications dashboard into sub-components:
  - `scheduled-medication-list`
  - `as-needed-medication-list`
  - `dose-swipe-row`
  - `medication-time-editor`
- [ ] Move shared medication adherence/due computation into `medication-adherence.service.ts`.
- [ ] Ensure Insights + Medications both use the same summary and due logic sources.

### Phase 3: Profile page decomposition

- [ ] Split Profile page into:
  - `participant-details-card`
  - `caregiver-access-card`
  - `participant-members-list`
  - `medication-management-card`
  - `medication-editor-sheet-content`
- [ ] Adopt `app-tone-card`, `app-card-header`, `app-labeled-value`, and `app-action-row` in Profile before adding new bespoke markup.
- [ ] Standardize message banners (success/error) with `app-resource-state` and/or `app-inline-message`.
- [ ] Isolate invite/revoke flows behind narrow output events from sub-components.

### Phase 4: Daily Reflection + Incident form decomposition

- [ ] Extract Daily Reflection into:
  - `reflection-facet-card` (Mood/Focus/Energy/Sleep)
  - `journal-note-card`
  - `reflection-action-bar`
- [ ] Extract shared bucket option UI to a dedicated presentational sub-component.
- [ ] Adopt `app-tone-card`, `app-card-header`, and `app-bucket-option` in Daily Reflection to align with Profile/Incident visual primitives.
- [ ] Keep facet score-to-label mapping and selection/default semantics inside Daily Reflection feature logic.
- [ ] Extract Incident form into:
  - `abc-section-card` (A/B/C variants)
  - `function-selector`
  - `occurred-at-picker`
  - `incident-save-footer`
- [ ] Reuse shared `app-tone-card`, `app-chip-pill`, and `app-labeled-field` in Incident form while keeping ABC interaction logic feature-local.

### Phase 5: Timeline + lower-bloat pages cleanup

- [ ] Split Timeline into:
  - `timeline-day-group`
  - `timeline-entry-card`
  - `timeline-feed-state`
- [ ] Review Login + Invite Accept for shared message/action primitives and adopt where useful.
- [ ] Keep low-bloat pages as-is unless a shared primitive clearly reduces duplication.

### Phase 6: Final hardening

- [ ] Remove dead CSS/selectors and orphaned helper methods after extraction.
- [ ] Re-run full frontend build/test verification (`docs/runbooks/frontend-build-verification.md`).
- [ ] Update architecture docs with new frontend component structure conventions.

## Category map for incremental execution

### Category A: Shared primitives (cross-app)

- `FCM-A1` Page intro component
- `FCM-A2` Section card container
- `FCM-A3` Resource state/feedback component
- `FCM-A4` Formatting utilities consolidation
- `FCM-A5` Tone card + card header primitives
- `FCM-A6` Labeled value/field + action pill primitives
- `FCM-A7` Skeleton loading standardization (`app-skeleton` adoption + removal of ad-hoc placeholders)

### Category B: Data-heavy dashboard refactors

- `FCM-B1` Insights component split
- `FCM-B2` Medications component split
- `FCM-B3` Shared medication adherence logic

### Category C: Profile and management flows

- `FCM-C1` Profile card decomposition
- `FCM-C2` Caregiver members/revoke sub-component
- `FCM-C3` Medication editor sheet extraction

### Category D: Form-heavy pages

- `FCM-D1` Daily Reflection facet card extraction
- `FCM-D2` Incident ABC section extraction
- `FCM-D3` Shared action footer patterns
- `FCM-D4` Incident form adoption of shared tone/field/chip primitives
- `FCM-D5` Daily Reflection adoption of tone/card-header/bucket-option primitives

### Category E: Feed and supporting pages

- `FCM-E1` Timeline entry decomposition
- `FCM-E2` Login/Invite shared messaging primitives

## Completion criteria

- [ ] No feature page component exceeds ~500 lines (target threshold, not hard blocker).
- [ ] Insights/Medications/Profile each use at least 2 extracted feature sub-components.
- [ ] Shared primitives are adopted by at least 2 features each before considered stable.
- [ ] Existing user-facing behavior remains unchanged (manual QA checklist pass).
- [ ] Docs updated to reflect new component boundaries and reusable primitives.

## Risks and mitigations

- **Risk:** Large multi-file diffs create merge churn.
  - **Mitigation:** Enforce phased, small PR slices by category ID.
- **Risk:** Shared component abstractions become too generic.
  - **Mitigation:** Extract from real duplicates only; avoid speculative APIs.
- **Risk:** Hidden behavior drift during template splits.
  - **Mitigation:** Preserve CSS classes/DOM hooks in first extraction pass; compare screenshots/flows per page.
