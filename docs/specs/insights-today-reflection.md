# Insights: Today's Reflection Card

## Summary
Add a dashboard card to the Insights page showing today's reflection status — either the bucket labels for logged dimensions or a prompt to log if nothing has been recorded yet.

## User job
A parent opening the app wants a quick at-a-glance view of today's reflection scores (or a nudge to log them) without navigating away from Insights.

## Required behaviors

### Card — logged state
- When today's reflection exists for the active participant, show each committed dimension's bucket label (e.g. "Mood: Steady · Focus: Dialed In · Sleep: Fine").
- Null (uncommitted) dimensions are omitted from the display.
- Card is tappable and navigates to `/daily-reflection` in edit mode.

### Card — not logged state
- When today's reflection does not exist, show a prompt ("How is [participant name] doing today?") with a "Log today's reflection" CTA.
- CTA navigates to `/daily-reflection`.

### Data
- The card uses existing data already loaded for the weekly summary (no additional API call required when today falls within the summary window).

### Placement
- Below the hero phrase / weekly summary header area, above the weekly rhythm dimension cards.

## Acceptance criteria
- [ ] Card appears on the Insights page.
- [ ] When today is logged: shows committed dimension bucket labels.
- [ ] Null dimensions are excluded from the logged display.
- [ ] When today is not logged: shows participant-name prompt and CTA.
- [ ] Card tap navigates to `/daily-reflection`.
- [ ] No extra API call is made if today falls within the existing summary window.

## Out of scope
- Inline score entry directly on the Insights card.
- Showing scores for any day other than today.
