# Med Dosage Naming

## Status

Exploring — leaning toward time-derived labels (Option D).

Last updated: 2026-02-15

## Problem

Medication setup captures structured frequency (`once-daily`, `twice-daily`, `three-times-daily`), but user-facing screens need human-readable dose-slot labels.

Today we map occurrence keys to static daypart names (`dose-1` = Morning, `dose-2` = Afternoon, `dose-3` = Evening). This creates mismatches when caregivers give doses outside the "expected" window — a dose given at 6pm still renders as "Afternoon" if it was logged against `dose-2`.

## Goals

- Keep dose-slot language simple and intuitive for caregivers.
- Preserve stable internal semantics for API/data (`occurrenceKey`).
- Ensure labels reflect when a dose was actually given, not just its ordinal position.

## Non-Goals

- Reminder scheduling or strict time-window rules.
- Changing backend schema for medication logs.
- Per-medication custom slot naming.

## Current Baseline (Implemented)

From `docs/product-specs/medication-command-center.md`:

- `dose-1` -> `Morning`
- `dose-2` -> `Afternoon`
- `dose-3` -> `Evening`

Static mapping from occurrence key to label. Works but can feel wrong when actual timing doesn't match the label.

## Candidate Approaches

### Option A — Static ordinal labels (current)

Labels derived from `occurrenceKey` regardless of when the dose was logged.

- 1x daily: `Morning`
- 2x daily: `Morning`, `Evening`
- 3x daily: `Morning`, `Afternoon`, `Evening`

Pros: simple, already implemented.

Tradeoff: label can mismatch reality. A dose given at 8pm still says "Afternoon" if it's `dose-2`.

### Option B — Numeric slots

- 1x daily: `Daily dose`
- 2x daily: `Dose 1`, `Dose 2`
- 3x daily: `Dose 1`, `Dose 2`, `Dose 3`

Pros: avoids implying specific times.

Tradeoff: less human-friendly, requires extra mental mapping.

### Option C — Hybrid (static keys + static display labels)

Internal keys stay as `dose-1`, `dose-2`, `dose-3`. Display labels are static daypart names. Extensible via locale overrides later.

Pros: decouples data from copy.

Tradeoff: still has the mismatch problem from Option A.

### Option D — Time-derived labels (preferred)

Derive the human-readable label from the **local timestamp** of the logged dose, not from the occurrence key. The occurrence key remains the stable data identifier; the label is a display-only concern.

#### Time windows (3x daily — school-day model)

Designed around a typical school-age child's day: before school, at school, after school.

| Window    | Local time    | Label     | Typical context          |
|-----------|---------------|-----------|--------------------------|
| Morning   | 3:00 – 11:00  | Morning   | Before school / wake-up  |
| Midday    | 11:00 – 14:00 | Midday    | At school / lunch        |
| Afternoon | 14:00 – 18:00 | Afternoon | Home from school         |
| Evening   | 18:00 – 3:00  | Evening   | Dinner / bedtime         |

Note: labels are kept short for UI density. "Morning" preferred over "Early Morning" for chip/row display.

#### Time windows (4x daily)

Same windows as above — 4x daily meds naturally map to all four slots. For 3x daily, the system uses Morning + Midday + Afternoon (stimulant pattern) or Morning + Afternoon + Evening depending on the medication's schedule. The right default depends on the med type and is a future decision.

#### School-administered doses

Stimulant medications commonly follow a before-school / at-school / after-school pattern. The midday dose is often administered by school staff, meaning the parent doesn't directly give or easily track it. This creates a UX challenge:

- The parent knows the dose was given but didn't administer it themselves.
- Logging it feels different from a dose they gave at home.
- Future work may need a "confirmed but not self-administered" state or a simplified school-dose logging flow.

This is out of scope for initial implementation but should influence how we design the logging interaction — avoid making parents feel they failed to track a dose they couldn't have tracked.

#### How it works

- **Prospective view** (checklist — "what's left today?"): Continue using occurrence-key-based slots so caregivers see a clear list of remaining doses.
- **Retrospective view** (history, timeline): Derive the label from the log entry's timestamp, so the label reflects when the dose was actually given.
- **Logging flow**: When a caregiver taps "log dose," the UI can suggest the current daypart as context (e.g., "Logging Evening dose") based on the current local time.

Pros: labels always match reality in history views, works naturally for any frequency, no static mapping to maintain per frequency count.

Tradeoff: two labeling strategies (prospective vs retrospective) adds some complexity. Edge cases when a dose is logged right at a window boundary.

## Recommended Direction

Adopt **Option D** with a two-context approach:

1. **Checklist context** (medications dashboard, "today's doses"): Use occurrence-key slots with static daypart defaults. This preserves the "what's left?" UX.
2. **History context** (timeline, past logs): Derive label from the log timestamp. This ensures labels reflect actual caregiver behavior.
3. **Logging context**: Default the label suggestion from current local time to give immediate context.

Keep `occurrenceKey` as the stable API/data key — never persist display labels.

## Open Questions

- For 3x daily meds, which three of the four windows apply? Likely depends on med type (stimulant = Morning/Midday/Afternoon vs. maintenance = Morning/Afternoon/Evening). How to model this?
- Should the 4x daily windows be configurable, or are fixed defaults sufficient?
- For as-needed (PRN) meds that don't have scheduled slots: just use the time-derived label with no checklist view?
- How should school-administered doses be represented in the logging UX? (See school-administered doses section.)

## Implementation Notes (When Activated)

- Add a shared `getDoseLabel(timestamp: Date): string` helper that maps local time to daypart label.
- Checklist views continue using the existing occurrence-key-to-label map.
- History/timeline views call `getDoseLabel()` with the log's timestamp.
- Keep API payloads keyed by `occurrenceKey`; never persist label text.
- Add tests for boundary conditions (e.g., 10:59 = Morning, 11:00 = Mid-Day).

## Related Docs

- `docs/product-specs/medication-command-center.md`
- `docs/product-specs/medication-frequency.md`
- `docs/architecture/data-modeling.md`
