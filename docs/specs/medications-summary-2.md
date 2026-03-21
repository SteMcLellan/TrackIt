# Medications Page: Interval Medication Adherence in Top Summary

## Summary
Align the top summary card on the `/medications` page to include interval medications in adherence language, mirroring the behaviour already present on the Insights compact summary card.

## User job
A parent viewing the Medications page needs the top-level adherence summary to reflect the full picture — including interval medications that are due or overdue today.

## Required behaviors
- Interval medications with `dueState` of `due` or `overdue` are counted in the "remaining" total alongside scheduled pending doses.
- Interval medications with `dueState` of `early` are excluded from the remaining count.
- Adherence copy on the Medications page summary card uses the same semantics as the Insights compact card:
  - "All on track" when no scheduled pending doses and no interval due/overdue items remain.
  - "N remaining" when any actionable items exist.
  - "None scheduled" when no actionable doses exist at all.
- Nearest-interval guidance is shown on the Medications summary card:
  - "Next interval due today"
  - "Next interval due in N days"
  - "Next interval overdue by N days"

## Acceptance criteria
- [ ] Medications page summary counts interval `due`/`overdue` items in the remaining total.
- [ ] "All on track" appears only when both scheduled and interval-due queues are empty.
- [ ] Interval `early` items are not counted as remaining.
- [ ] Nearest-interval guidance text appears on the Medications summary card.
- [ ] The logic matches the already-correct implementation on the Insights compact card.

## Out of scope
- Changes to the Insights compact card (it is already correct).
- New API endpoints or schema changes.
- Changes to interval due-state logic.
