# TrackIt Implementation Plan

Confirmed remaining work by comparing `docs/specs/*`, `docs/product-specs/*`, and the current `frontend/src/*` + `api/src/*` code.

## Completed

- [x] **Clerk frontend login** (`docs/specs/clerk-auth-1.md`) — Clerk startup + hosted sign-in in `frontend/src/main.ts`, `frontend/src/app/shared/services/clerk.service.ts`, and `frontend/src/app/features/auth/login.component.ts`; app-session exchange in `frontend/src/app/shared/services/auth.service.ts`; Clerk-backed auth exchange in `api/src/functions/auth-login.ts`, `api/src/functions/auth-refresh.ts`, and `api/src/shared/auth.ts`.

- [x] **Clerk startup failure handling** — `clerk.service.ts` captures and logs initialisation failures instead of rethrowing; `login.component.ts` shows a recovery-oriented error card; `shell.component.ts` renders an authenticated-shell warning banner when Clerk is unavailable.

- [x] **Dynamic hero phrase** (`docs/product-specs/dynamic-hero-phrase.md`) — Tiered phrase selection from composite mood/focus/sleep score, daily rotation by `dayOfYear % 10`, silent 404/error fallback to hardcoded defaults, static placeholder while loading.

- [x] **Medication frequency model** (`docs/product-specs/medication-frequency.md`) — Strict frequency enum enforced on create/update, occurrence-key rules validated per frequency, interval schedule (`intervalDays`, `anchorDateLocal`, `anchorPolicy: reset-on-taken`) required and validated for `interval-days`, `frequencyText` rejected, anchor-reset on `status='taken'`, `dueState` and `nextDueLocalDate` returned.

- [x] **Medication command center** (`docs/product-specs/medication-command-center.md`) — `/medications` route with swipe-first workflow, per-dose actionable rows, interval medication due-state cards, time editing for taken logs. Insights compact read-only summary card with adherence language. Route guarded by `ActiveParticipantGuard`.

- [x] **Timeline day browser** (`docs/product-specs/timeline-day-browser.md`) — Last-30-days all-days window with ghost placeholder cards for missed days, filled emerald `+` button on missed days, subtle `+` on populated days, date-parameterised medication log and daily reflection screens for backfill.

## Remaining work by priority

- [ ] **Behavior incident filter alignment and list/detail routes** (`docs/specs/behavior-incidents-2.md`)
  Confirmed gaps: the Insights dashboard calls the incidents endpoint with `fromUtc`/`toUtc` at `frontend/src/app/features/insights/insights-dashboard.component.ts:812`, but the API accepts `startDate`/`endDate` (YYYY-MM-DD local date) matching every other date-range endpoint. Fix the Insights call to use `startDate`/`endDate`. The frontend only exposes the create flow at `/behavioral-moments/new` via `frontend/src/app/app.routes.ts:31`; the spec-required list (`/incidents`) and detail/edit/delete (`/incidents/:id`) routes do not exist. Also update `docs/product-specs/behavior-tracking-abc.md` to replace `fromUtc`/`toUtc` with `startDate`/`endDate`.

- [ ] **Daily reflection partial entries** (`docs/specs/daily-reflection-2.md`)
  Confirmed gap: new forms initialise every score signal to `50` at `frontend/src/app/features/daily-reflection/daily-reflection.component.ts:484`, so all four dimensions are always saved regardless of whether the parent touched them. The spec (`docs/product-specs/daily-reflection-scoring.md:23`) explicitly requires nullable partial entries. Fix: track explicit bucket selection; untouched dimensions send `null`.

- [ ] **Insights: today's reflection card** (`docs/specs/insights-today-reflection.md`)
  Confirmed gap: the spec (`docs/product-specs/daily-reflection-scoring.md:288`) requires a dashboard card showing today's bucket labels or a "log today" prompt. The current Insights page only renders a link to `/daily-reflection` and weekly summary cards (`frontend/src/app/features/insights/insights-dashboard.component.ts:62`).

- [ ] **Medications page: interval adherence in top summary** (`docs/specs/medications-summary-2.md`)
  Confirmed gap: the Medications page top summary card counts only scheduled doses (`frontend/src/app/features/medications/medications-dashboard.component.ts:1092`), while the spec (`docs/product-specs/medication-command-center.md:37`) requires the same adherence language as Insights, which already includes `intervalActionableCount` and nearest-due guidance (`frontend/src/app/features/insights/insights-dashboard.component.ts:138`).

- [ ] **Timeline quick-add: behavior incident decision**
  Confirmed gap: the timeline quick-add `+` menu only exposes reflection and medication actions (`frontend/src/app/features/timeline/timeline.component.ts:75`). The timeline day-browser spec (`docs/product-specs/timeline-day-browser.md:14`, `:76`) lists "Log behavior incident" as an open question. A decision must be made (include or explicitly exclude), then the spec updated and the menu implemented accordingly.
