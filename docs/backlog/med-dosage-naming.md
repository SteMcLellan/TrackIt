# Med Dosage Naming

## Status

Exploring options - needs UX/content validation before implementation.

Last updated: 2026-02-16

## Problem

Medication setup captures structured frequency (`once-daily`, `twice-daily`, `three-times-daily`), but user-facing screens often need human-readable dose-slot labels.

Today we rely on default slot names (`Morning`, `Afternoon`, `Evening`) for rendering dose rows. This is clear in many cases, but we have not defined:

- When those labels are canonical vs. flexible copy.
- Whether labels should vary by dosage count, locale, or caregiver preference.
- How labels map to saved occurrence keys (`dose-1`, `dose-2`, `dose-3`) across screens.

## Goals

- Keep dose-slot language simple and intuitive for caregivers.
- Preserve stable internal semantics for API/data (`occurrenceKey`).
- Ensure consistent labels across Insights, Medications, timeline, and future reminders.

## Non-Goals

- Adding reminder scheduling or strict time-window rules in this phase.
- Changing backend schema for medication logs.
- Introducing per-medication custom slot naming in this first iteration.

## Current Baseline (Implemented)

From `docs/product-specs/medication-command-center.md`:

- `dose-1` -> `Morning`
- `dose-2` -> `Afternoon`
- `dose-3` -> `Evening`

This baseline works functionally but is not yet ratified as a product/content standard.

## Key Decisions Needed

1. Canonical labels for each supported frequency.
2. Whether labels are static or adaptive (for example, "Midday" vs. "Afternoon").
3. Whether "Night" should replace "Evening" in caregiver-facing copy.
4. How to localize or regionalize labels in the future.

## Candidate Naming Sets

### Option A (Current)

- 1x daily: `Morning`
- 2x daily: `Morning`, `Evening`
- 3x daily: `Morning`, `Afternoon`, `Evening`

Pros: already implemented, familiar, low migration cost.

Tradeoff: `Afternoon`/`Evening` may not match all caregiver routines.

### Option B (Neutral Dayparts)

- 1x daily: `Daily dose`
- 2x daily: `Dose 1`, `Dose 2`
- 3x daily: `Dose 1`, `Dose 2`, `Dose 3`

Pros: avoids implying specific times.

Tradeoff: less human-friendly in quick logging flows.

### Option C (Hybrid)

- Internal stable keys: `dose-1`, `dose-2`, `dose-3`
- Default display: `Morning`, `Afternoon`, `Evening`
- Optional content override per locale later.

Pros: keeps current UX while preserving extensibility.

Tradeoff: requires explicit content/token governance.

## Recommended Direction (Backlog Default)

Adopt **Option C**:

- Keep `occurrenceKey` semantics unchanged.
- Keep current default labels for now.
- Treat display labels as content-layer tokens (not hardcoded literals long-term).

## UX Research Questions

- Do caregivers prefer `Evening` or `Night` for the final dose slot?
- Is `Afternoon` clear enough, or is `Midday` more understandable?
- For twice-daily meds, should copy be explicitly `Morning`/`Evening` or generic `Dose 1`/`Dose 2`?
- Do parents interpret these labels as strict times (which could cause anxiety) or rough anchors?

## Simulated UX Interview (Synthetic)

Note: This is a simulated interview synthesis for product exploration, not real participant research.

### Simulation Setup

- Simulated participants: 6 caregivers (mixed routines, school-age children, daily and as-needed meds).
- Format: 20-minute moderated interviews with scenario walkthroughs.
- Core prompt themes:
  - "How would you expect a twice-daily schedule to be labeled?"
  - "What does `Afternoon` mean to you in practice?"
  - "Would `Dose 1/2/3` feel clearer or less helpful?"
  - "Do these labels feel strict or flexible?"

### Synthesized Findings

1. Human-readable dayparts were preferred for quick scanning.
   - Most simulated caregivers recognized `Morning` and `Evening` immediately.
   - `Dose 1/2/3` was seen as less friendly and requiring extra mental mapping.

2. `Afternoon` was the least stable label.
   - Some interpreted it as school-time (hard to administer).
   - `Midday` tested slightly better for neutrality, but still not universal.

3. Caregivers treated labels as anchors, not strict schedules.
   - Anxiety increased when copy sounded rigid.
   - Language implying flexibility ("typical slot") reduced concern.

4. For two doses, explicit dayparts outperformed numeric slots.
   - `Morning` + `Evening` felt practical and memorable.
   - Numeric labels were acceptable only as a fallback in edge cases.

5. Terminology preference for final slot leaned slightly toward `Evening` over `Night`.
   - `Night` was interpreted by some as "right before sleep."
   - `Evening` felt broader and less prescriptive.

### Product Implications from Simulation

- Keep default display labels as dayparts (supports Option C).
- Keep internal keys (`dose-1`, `dose-2`, `dose-3`) unchanged.
- Prefer `Evening` over `Night` as default.
- Consider evaluating `Midday` vs `Afternoon` in real research before hardening copy.
- Add lightweight helper text in UI copy where needed to signal these are flexible anchors, not exact times.

### Recommended Follow-up (Real Research)

- Run 5-8 real caregiver interviews with clickable prototypes using:
  - Variant 1: `Morning`, `Afternoon`, `Evening`
  - Variant 2: `Morning`, `Midday`, `Evening`
  - Variant 3: `Dose 1`, `Dose 2`, `Dose 3` (control)
- Success metric: fastest correct interpretation with lowest reported schedule anxiety.

## Implementation Notes (When Activated)

- Centralize slot-label mapping in one shared helper/module instead of per-component constants.
- Keep API payloads keyed by `occurrenceKey`; do not persist label text.
- Add tests that confirm consistent labels for:
  - Medications dashboard rows
  - Insights summary hints (if slot names appear)
  - Any timeline/event rendering that references dose slots

## Related Docs

- `docs/product-specs/medication-command-center.md`
- `docs/product-specs/medication-frequency.md`
- `docs/architecture/data-modeling.md`
