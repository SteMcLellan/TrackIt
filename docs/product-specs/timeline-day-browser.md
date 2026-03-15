# Timeline — Day Browser & Backfill

Status: Implemented
Last updated: 2026-03-15

## Problem

The timeline only renders days that have logged events. Days where nothing was recorded are invisible, so there is no way to discover a missed entry or navigate to a past date to backfill it. Parents who miss a day of medication logging or a daily reflection have no in-app path to add or correct it.

## Proposed Solution

Extend the timeline into a **day browser**: every day in the recent window is rendered as a section regardless of whether it has events. The interaction model has two distinct affordances:

1. **`+` button in the day header** — the single entry point for adding anything new to that day (medication log, reflection, or behavior incident). Opens a contextual quick-add menu.
2. **Tap an existing event card** — opens that specific entry in edit mode. Cards are tappable to correct mistakes; they do not need a separate edit button.

This cleanly separates "add something new" from "edit something that exists", and keeps the day header as the consistent, discoverable action point across all day states.

## Design Reference

- **Pencil frame**: `components.pen` → frame `pcz8V` ("newTimeline") — shows three day states side by side
- **Stitch screen**: `projects/2002730124455423542/screens/a6196e0fc08b413a834cf00853db202d` ("Timeline with Day Actions") — HTML reference used to inform the Pencil layout

## Three Day States

### State 1 — Populated day (TODAY)
Event cards render normally. The `+` button sits in the top-right of the day header as a small circular button (28px, white bg, `#e2e8f0` border, gray `+` icon). It is present but understated — the cards are the visual focus. Tapping any card opens it for editing.

### State 2 — Partially logged day (YESTERDAY)
Same as above. One or more event types are missing but the `+` button is the path to add them, not inline buttons below the card stack. The parent can see what was logged and decide whether to add more.

### State 3 — Missed day (THURSDAY, MAR 12)
No event cards. The day section renders a single **ghost placeholder card**: white background, 8px radius, soft shadow, dashed 1px `#e2e8f0` border. Inside: a muted calendar icon and "Nothing logged for this day" in `#94a3b8`. No action buttons inside the card — it is purely informational.

The `+` button in this day's header is more prominent: filled `#ecfdf5` (Soft Emerald) background with a `#10b981` (Vital Emerald) `+` icon. This draws the eye to the action since the card itself offers no affordance. The timeline node dot for this day uses an open ghost ring (dashed stroke, no fill) rather than the filled colored dot used on populated days.

## Why Not Buttons at the Bottom of Each Day?

An earlier iteration placed "Log medications" and "Add reflection" pill buttons at the bottom of every day's card stack. This was rejected for three reasons:

1. **Conflated two different interactions.** "Log a new dose" and "edit the dose I already logged" are not the same action, but both were implied by the same button.
2. **Wrong location.** Buttons at the bottom of a card stack feel like footnotes, not primary actions. They're easy to miss after scrolling past several cards.
3. **Ambiguous on populated days.** A "Log medications" button on a day that already has a medication log raises the question: does this add a second log or replace the existing one?

The day header is the right location because it's always visible at the top of each section, doesn't compete with the card content, and is spatially associated with the whole day rather than the last card in the stack.

## Date Window

- **Last 30 days**: all days rendered, with or without events. Matches the existing medication log API window.
- **Older than 30 days**: only days with at least one event are rendered (current behavior). Reflections have no hard API window so older reflections remain editable if navigated to directly, but the timeline does not surface them as empty placeholders.

## Prerequisites

Neither entry screen currently supports being opened for a specific past date. Both need to be addressed before this feature can be built:

### 1. Medication log screen — date-parameterized entry

The medication log screen must accept a `logLocalDate` parameter so the timeline can open it pre-set to a past date. The screen should:

- Load existing log state for that date (taken / not taken per occurrence)
- Allow logging or updating each occurrence
- Enforce the existing 30-day API window (reject dates outside it at the UI layer before attempting a request)

### 2. Daily reflection screen — date-parameterized entry

The daily reflection screen must accept a `logLocalDate` parameter. The screen should:

- Load the existing reflection for that date if one exists (edit mode)
- Open blank if no reflection exists for that date (create mode)
- Display a visible label when editing a past date (e.g. "Reflecting on Wednesday, Mar 11")

## What the Mockup Does Not Show

- **Tappable cards**: Event cards should be tappable to open in edit mode. The Pencil frame does not show chevrons on the cards (the card layout made this difficult to sketch) but the intent is that every card is an edit entry point.
- **The quick-add menu**: Tapping `+` should open a small contextual sheet offering "Log medication", "Add reflection", and "Log behavior incident". The menu should omit options that are unavailable for that day (e.g. hide "Log medication" for days beyond 30 days).
- **The ghost ring node**: The Pencil frame shows the missed-day timeline node as a dashed-ring circle (vs. filled colored dot on populated days). This signals "nothing here yet" without requiring text to say so.

## Related Docs

- `docs/backlog/daily-reflection-historical-entry.md` — policy options for how far back reflections should be allowed; recommends Option C (unlimited with latency signal)
- `docs/product-specs/medication-frequency.md` — medication log API window (30 days) and occurrence key rules
- `docs/product-specs/daily-reflection-scoring.md` — one reflection per participant per `logLocalDate`; re-opening the same date is an edit

## Open Questions

- **Quick-add menu contents**: Should the menu also offer "Log behavior incident" or keep it to medication + reflection since those are the most time-sensitive backfill cases?
- **30-day boundary UX**: Days 31+ back show no `+` button (medication API limit). Should the header indicate why, or silently omit it? A reflection-only `+` is possible but may confuse parents who expect to log both.
- **Populated-day `+` discoverability**: The gray `+` on populated days is intentionally subtle. Risk is that parents never discover it. May need a brief onboarding callout or a "you haven't added a reflection yet" nudge on the day label.
