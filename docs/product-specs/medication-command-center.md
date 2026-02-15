# Medication Command Center (Insights Split)

## Status

Implemented in frontend (commit `7f6366fbab95f9a8c464bcd70c392ec569eca1e0`, 2026-02-15).

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
  - `None scheduled` when no scheduled doses exist that day.
- Show a pending medication name hint when available.
- Card is tappable and navigates to `/medications`.
- Insights does not expose medication swipe/edit/remove interactions.

### Medications (`/medications`)

- Dedicated logging surface for all medication interaction.
- Preserve swipe-first workflow:
  - Scheduled dose rows: swipe right to mark `taken`; swipe left to mark `not_taken`.
  - As-needed base rows: swipe right to log a new as-needed dose.
  - As-needed logged rows: swipe left to remove.
- Support time editing for taken logs from both scheduled and as-needed rows.
- Group content into:
  - `Scheduled` cards with dose-slot rows.
  - `As Needed` cards with logged-event previews plus overflow count.
- Show top-level summary card with the same adherence language as Insights.

## Dose and Adherence Semantics

- Scheduled adherence is fractional, not binary:
  - `once-daily` => 1 expected dose
  - `twice-daily` => 2 expected doses
  - `three-times-daily` => 3 expected doses
- Taken count is capped at expected doses per medication/day for progress display.
- Dose slot labels use human-friendly mapping:
  - `dose-1` => `Morning`
  - `dose-2` => `Afternoon`
  - `dose-3` => `Evening`
- As-needed logs do not increase scheduled expected-dose totals.

## Data and API Dependencies

- Uses existing participant-scoped medication and medication-log APIs.
- Relies on `frequency` enum model and occurrence-key rules documented in `docs/product-specs/medication-frequency.md`.
- Time edits compute timezone offsets from local date/time and persist via medication-log upsert.

## Routing and Access

- Route added: `/medications` under authenticated shell.
- Guarding: `ActiveParticipantGuard` required, same as other participant-scoped shell routes.
- Current navigation entry: Insights summary card deep-link.

## Explicitly Out of Scope (Current State)

- Bottom-nav medications tab (not implemented in this change).
- Reminder/notification scheduling.
- New backend schema changes beyond existing frequency/occurrence model.

## Success Criteria

- Insights is medication read-only and lighter-weight.
- Medication logging behaviors remain fully available on `/medications`.
- Fractional adherence is visible in both Insights and Medications summary cards.
- Multi-dose scheduled medications are represented as per-dose actionable rows.
