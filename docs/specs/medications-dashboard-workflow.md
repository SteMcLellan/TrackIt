# Medications Dashboard Workflow Emphasis

## Summary

The Medications Dashboard reads as a sparse summary view rather than an active logging and management surface. The product spec describes a swipe-first workflow with distinct scheduled and as-needed sections, interval guidance, and time editing. The current design does not communicate that operational depth.

## Job to Be Done

When I open the Medications Dashboard, I want to see exactly which medications are due and take action on them in as few taps as possible, so I can log doses quickly and stay on top of the medication schedule without having to navigate elsewhere to understand what needs doing.

## Required Behaviors

- The screen presents two clearly labeled sections: **Scheduled** medications and **As-Needed** medications.
- Each medication card in the Scheduled section shows the next due time and a primary interaction affordance (e.g. swipe or tap to log).
- Each medication card in the As-Needed section shows the allowed interval and the time since last dose.
- The summary card (totals or adherence overview) is present but does not dominate the layout — it serves as a contextual supplement, not the primary focus.
- The screen supports a swipe-first logging workflow as described in `docs/product-specs/medication-command-center.md`.
- Time editing is accessible from individual medication cards without navigating away from the screen.

## Acceptance Criteria

- A user can identify which medications are due at a glance without reading through a flat list.
- The primary logging action for a scheduled medication is reachable in one interaction from the dashboard.
- As-needed medications show when they were last taken and whether they can be taken again.
- The summary card is visually subordinate to the scheduled and as-needed sections.
- The screen validates at 375px and 390px without overflow or clipping.

## Out of Scope

- Changes to the medication data model or API.
- Notification or reminder behavior.
- Medication setup and add/edit flows (those live in separate forms/sheets).

## Doc Updates on Completion

- `docs/product-specs/medication-command-center.md` — if implementation settles layout or interaction decisions not already specified there (e.g. exact swipe gesture behavior, section ordering), record them as canonical.
- `docs/backlog/ui-feedback-general.md` — mark issue 4 (Medications screen lacks action emphasis) resolved.

## References

- `docs/product-specs/medication-command-center.md`
- `docs/product-specs/medication-frequency.md`
- `docs/architecture/frontend-interaction-principles.md`
- `docs/specs/shell-viewport-normalization.md`
