# TrackIt Implementation Plan

Last updated: 2026-03-21

---

## Priority 1 — Bug: Behavior Incident Filter Contract (behavior-incidents-2.md)

> **Why first**: Active data is silently not loading on the Insights page. The `incidentsResource` in `InsightsDashboardComponent` sends `fromUtc`/`toUtc` ISO timestamps but the API only accepts `startDate`/`endDate` YYYY-MM-DD local-date strings. This means the 7-day behavioral moments preview always returns empty.

- [x] **Fix `incidentsResource` query params in `InsightsDashboardComponent`**
  - File: `frontend/src/app/features/insights/insights-dashboard.component.ts`
  - Replace `fromUtc` / `toUtc` ISO params with `startDate` / `endDate` YYYY-MM-DD local-date params.
  - `endDate` = `todayLocalDate()`. `startDate` = 7 days prior, derived the same way `todayLocalDate()` is computed (local date, not UTC offset).
  - Both the `unknown`-participant guard branch and the live branch must be updated.
  - Note: `BehaviorIncidentService.listIncidents()` already accepts `startDate`/`endDate`; `httpResource` inline params just need to match.

---

## Priority 2 — Bug: Daily Reflection Null-Score Defaults (daily-reflection-2.md)

> **Why second**: Every new reflection silently commits score `50` for all four dimensions even when the user has not tapped anything. Partial entries are a first-class data-integrity requirement; sending `50` for untouched dimensions corrupts longitudinal trend data.

- [ ] **Initialize all four score signals to `null` instead of `50`**
  - File: `frontend/src/app/features/daily-reflection/daily-reflection.component.ts`
  - Change: `signal<number | null>(50)` → `signal<number | null>(null)` for `moodScore`, `focusScore`, `energyScore`, `sleepScore`.

- [ ] **Add save guard: block save when zero dimensions are committed**
  - Same file, `saveReflection()` method.
  - Before calling `upsertReflection`, check that at least one score is non-null.
  - If all four are null, set `errorMessage` to `"Select at least one dimension to save"` and return early.
  - No new UI elements required; the existing `errorMessage` signal and its `@if` block in the template already render the message.

- [ ] **Add visual pre-highlight for Balanced bucket when score is null**
  - Same file, bucket-option template sections.
  - Add a CSS class condition: `[class.guide]="dimensionScore() === null && opt.bucket === 3"` for each dimension.
  - Add a `.bucket-option.guide` style that shows a subtle highlight (e.g., dashed border or muted background) without triggering the committed `.selected` style.
  - Tapping a bucket calls `onBucketSelect()` which sets the signal — no change needed there.

- [ ] **Fix loading of existing reflection with null scores**
  - Same file, `effect()` in constructor that seeds signal values from fetched reflection.
  - When `reflection.moodScore` is `null`, the signal must remain `null` (no bucket selected), not coerced to `50`.
  - Verify that the seeded-from-existing guard does not prevent re-loading if the user navigates away and back.

---

## Priority 3 — Missing Feature: Medications Summary Card Interval Support (medications-summary-2.md)

> **Why third**: The `/medications` page summary card explicitly skips `interval-days` medications, so the top-level adherence numbers are incomplete. The Insights summary card already handles interval medications correctly — the `/medications` page needs to match it.

- [ ] **Update `medicationSummary` computed in `MedicationsDashboardComponent` to include interval medications**
  - File: `frontend/src/app/features/medications/medications-dashboard.component.ts`
  - The Insights version of this computed (in `insights-dashboard.component.ts`) is the reference. Port its interval-handling logic:
    - Track `intervalActionableCount` (count of interval meds where `dueState !== 'early'`).
    - Track `nearestIntervalDeltaDays` and derive `nearestIntervalDueLabel`.
  - Return shape should include: `{ totalExpectedDoses, takenDoses, intervalActionableCount, nearestIntervalDueLabel }`.

- [ ] **Update `adherenceStatus` computed in `MedicationsDashboardComponent` to factor in interval actionable count**
  - Same file.
  - Currently only checks `totalExpectedDoses` / `takenDoses`. Add: return `'pending'` when `intervalActionableCount > 0` even if `totalExpectedDoses === 0`.
  - Return `'none'` only when both `totalExpectedDoses === 0` AND `intervalActionableCount === 0`.

- [ ] **Update summary card template to display interval-aware copy**
  - Same file, template section.
  - "None scheduled" only when both `totalExpectedDoses === 0` AND `intervalActionableCount === 0`.
  - Show remaining count when any actionable items (scheduled or interval due/overdue) exist.
  - Show `nearestIntervalDueLabel` when non-null (e.g., "Next interval due today", "Next interval due in N days", "Next interval overdue by N days").

---

## Priority 4 — Missing Feature: Today's Reflection Card on Insights (insights-today-reflection.md)

> **Why fourth**: The spec calls for a status card showing committed dimension labels when today's reflection has been logged, or a prompt when not. The summary endpoint already returns the 7-day window including today; no extra API call is needed.

- [ ] **Extract today's reflection entry from `summaryResource` data**
  - File: `frontend/src/app/features/insights/insights-dashboard.component.ts`
  - Add a computed `todayReflectionSummary` that reads `summaryResource.value()` and finds the `points` entry where `logLocalDate === todayLocalDate()` for each metric series.
  - Result: `{ mood: number | null, focus: number | null, energy: number | null, sleep: number | null }` — null if no entry or score was null.
  - Add helper `scoreToBucketLabel(score: number | null, dimension: string): string | null` that maps a 0-100 score to a bucket label using the standard 0-19/20-39/40-59/60-79/80-100 mapping from the scoring spec. Returns null when score is null.

- [ ] **Add `todayReflectionLogged` computed**
  - Same file. Returns `true` if at least one dimension in `todayReflectionSummary()` is non-null.

- [ ] **Replace the simple "Daily Reflection" CTA section with the status card**
  - Same file, template section.
  - Placement: below hero phrase / weekly summary header, above weekly rhythm dimension cards.
  - Logged state: show card with committed (non-null) dimension labels joined with ` · ` (e.g., `"Mood: Steady · Focus: Dialed In"`). Card navigates to `/daily-reflection` on tap.
  - Not-logged state: show prompt (`"How is [participantName()] doing today?"`) with "Log today's reflection" CTA navigating to `/daily-reflection`.
  - Loading state: while `summaryResource.isLoading()`, show the not-logged state or a skeleton; do not show misleading "not logged" copy before data arrives.

---

## Priority 5 — Missing Routes: Incident List, Detail, and New (behavior-incidents-2.md)

> **Why fifth**: Users can create incidents but cannot browse or manage them. The service layer (`BehaviorIncidentService`) already has all CRUD methods ready.

- [ ] **Add `/incidents` list route and `IncidentListComponent`**
  - New file: `frontend/src/app/features/incidents/incident-list.component.ts`
  - Filters: date-range (default last 30 days, `startDate`/`endDate` YYYY-MM-DD) and function (sensory/tangible/escape/attention/all).
  - Paginated newest-to-oldest via `BehaviorIncidentService.listIncidents()`. Show "Load more" button when `nextToken` is returned.
  - Each row shows date/time, ABC summary line, function label; tapping navigates to `/incidents/:id`.
  - Register in `app.routes.ts` under shell with `ActiveParticipantGuard`.

- [ ] **Add `/incidents/:id` detail/edit route and `IncidentDetailComponent`**
  - New file: `frontend/src/app/features/incidents/incident-detail.component.ts`
  - Load via `BehaviorIncidentService.getIncident()`.
  - Shows A, B, C, place, function, date/time.
  - Edit mode (`?edit=true`) pre-populates the form fields (reuse `BehavioralMomentCreateComponent` pattern); submits via `BehaviorIncidentService.updateIncident()`.
  - Delete button shows inline confirmation step (no browser `confirm()` dialog); calls `BehaviorIncidentService.deleteIncident()` then navigates to `/incidents`.
  - Register in `app.routes.ts` under shell with `ActiveParticipantGuard`.

- [ ] **Add `/incidents/new` route alias**
  - Add `{ path: 'incidents/new', component: BehavioralMomentCreateComponent }` alongside existing `behavioral-moments/new` (keep both to avoid breaking deep links during transition).
  - Update `BehavioralMomentCreateComponent` success-state "Log another" link to use `/incidents/new`.
  - Update the Insights "Log a Moment" CTA from `/behavioral-moments/new` to `/incidents/new`.

---

## Priority 6 — Documentation: Align Product Spec with API Contract (behavior-incidents-2.md)

> **Low urgency** — no runtime impact, but keeps the spec accurate for future agents.

- [ ] **Update `docs/product-specs/behavior-tracking-abc.md` list query params**
  - File: `docs/product-specs/behavior-tracking-abc.md`
  - Replace `fromUtc`, `toUtc` (ISO 8601 UTC) with `startDate`, `endDate` (YYYY-MM-DD local dates) in the API surface section.

---

## Completed

- [x] **clerk-auth-1.md** — Clerk frontend login: `ClerkService` + `LoginComponent` with Clerk widget implemented. Confirmed by git commit `feat(login): use clerk`.
