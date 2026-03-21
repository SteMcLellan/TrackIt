# TrackIt Implementation Plan

Last updated: 2026-03-21

---

## Completed

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

---

### Priority 5 — UX: Behavioral Moment Create Form Density (behavioral-moment-create-form.md)

**Current state (confirmed, `@stitch-status: converted`):**
- A/B/C semantic color coding in place ✅
- In each ABC section, `<app-chip-selector>` appears **before** `<textarea>` (template lines 103–152 confirm order: chip → textarea for all three sections) ❌
- Function card is first in form; with hero + function grid, the first text field (antecedent textarea) is not visible on 390×844 without scrolling ❌

**Required changes in `BehavioralMomentCreateComponent`:**
- Within each ABC section: move the textarea **above** the chip-selector, or make the chip-selector visually subordinate (smaller, collapsed by default, or labelled "quick tags" below the text area).
- Reduce vertical space of the function grid if possible so the antecedent text field is visible on first screen load at 390×844.
- The primary Save action should be reachable by scrolling approximately one screen length.
- Preserve A/B/C semantic color coding.

**Acceptance criteria (from spec):**
- On 390×844, first text field visible without scrolling.
- Save action reachable by scrolling ~one screen.
- Screen validates at 375px/390px without overflow/clipping.

**Doc updates on completion:**
- `docs/product-specs/behavior-tracking-abc.md` — record layout/field ordering decisions
- `docs/backlog/ui-feedback-general.md` — mark issue 5 resolved
