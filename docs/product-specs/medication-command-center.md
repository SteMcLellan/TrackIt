# Medication Command Center (Insights Split)

## Status

Implemented in frontend.
Last updated: 2026-02-24.

## Problem

The old Insights page mixed two intents:
- Read-oriented reflection (weekly rhythms, behavioral context, reflection entry points).
- Action-oriented medication logging (swipe interactions, time edits, as-needed CRUD).

This increased page complexity and made medication workflows compete with insight scanning.

## Product Outcome

Medication logging moved to a dedicated `/medications` route, and Insights now shows a compact, read-only medication adherence summary card that links to that route.

## User Experience Requirements

### Insights (`/insights`)

- Show medication adherence as a compact summary card.
- Show dose progress as `taken of total` for scheduled medications.
- Show supportive status messaging:
  - `All on track` when complete.
  - `N remaining` when pending.
  - `None scheduled` when no actionable scheduled/interval doses exist.
- Keep `remaining` actionable-now:
  - scheduled pending doses
  - interval medications that are `due` or `overdue`
  - exclude interval medications that are still `early`
- Show one pending medication name hint when available for scheduled doses.
- Show nearest interval guidance line when interval meds exist:
  - `Next interval due today`
  - `Next interval due in N days`
  - `Next interval overdue by N days`
- Card is tappable and navigates to `/medications`.
- Insights does not expose medication swipe/edit/remove interactions.

### Medications (`/medications`)

- Dedicated logging surface for all medication interaction.
- Show active interval medications in Scheduled section (not only on due days).
- Interval card copy includes:
  - frequency label (`Every X days`)
  - `Last logged`
  - `Next due`
  - due-state chip (`Due today`, `Due in N days`, `Overdue by N days`)
- Preserve swipe-first workflow:
  - Scheduled dose rows: swipe right to mark `taken`; swipe left to mark `not_taken`.
  - As-needed base rows: swipe right to log a new as-needed dose.
  - As-needed logged rows: swipe left to remove.
- Support time editing for taken logs from both scheduled and as-needed rows.
- Group content into:
  - `Scheduled` cards with dose-slot rows.
  - `As Needed` cards with logged-event previews plus overflow count.
- Show top-level summary card with the same adherence language as Insights.
- Canonical display order: Scheduled → As Needed → Summary card (de-emphasized contextual supplement). The summary card is intentionally subordinate — it uses a gray background, no drop shadow, and a 2rem top margin to signal that it supplements rather than leads the action sections.

## Dose and Adherence Semantics

- Scheduled adherence is fractional, not binary:
  - `once-daily` => 1 expected dose
  - `twice-daily` => 2 expected doses
  - `three-times-daily` => 3 expected doses
- Interval medications contribute to actionable state through due-state evaluation:
  - `early` does not increase remaining
  - `due` and `overdue` increase remaining
- Taken count is capped at expected doses per medication/day for progress display.
- Dose labels are context-based:
  - Prospective checklist context (`/medications` untaken rows): slot labels from `occurrenceKey`.
  - Retrospective context (`/medications` taken rows and `/timeline` medication logs): labels derived from logged local time.
- Daypart windows for time-derived labels:
  - `Morning`: `03:00-10:59`
  - `Midday`: `11:00-13:59`
  - `Afternoon`: `14:00-17:59`
  - `Evening`: `18:00-02:59`
- As-needed logs do not increase scheduled expected-dose totals.

## Data and API Dependencies

- Uses existing participant-scoped medication and medication-log APIs.
- Relies on `frequency` enum model and occurrence-key rules documented in `docs/product-specs/medication-frequency.md`.
- Time edits compute timezone offsets from local date/time and persist via medication-log upsert.
- Interval log upsert responses may include `dueState` and `nextDueLocalDate`.

## Routing and Access

- Route added: `/medications` under authenticated shell.
- Guarding: `ActiveParticipantGuard` required, same as other participant-scoped shell routes.
- Current navigation entry: Insights summary card deep-link.

## Explicitly Out of Scope (Current State)

- Bottom-nav medications tab (not implemented in this change).
- Reminder/notification scheduling.
- New backend schema changes beyond existing frequency/occurrence model.
- Date correction for existing taken logs in `/medications` is intentionally deferred; current in-place correction supports time only.

## Success Criteria

- Insights is medication read-only and lighter-weight.
- Medication logging behaviors remain fully available on `/medications`.
- Fractional adherence is visible in both Insights and Medications summary cards.
- Multi-dose scheduled medications are represented as per-dose actionable rows.
- Interval medications are visible with due guidance in `/medications` and summary context in `/insights`.
