# Behavioral Moment Create Form Density

## Summary

The Behavioral Moment Create screen is currently too tall before the primary save action appears. Preset chips and decorative framing occupy substantial vertical space while the actual written incident details — antecedent, behavior, consequence, place, and time — feel secondary. The core job of this screen is capturing meaningful ABC incident data, and the layout should reflect that priority.

## Job to Be Done

When I'm recording a behavioral incident, I want to get to the text entry fields immediately and reach the save action without excessive scrolling, so I can capture accurate antecedent, behavior, and consequence details quickly while the moment is still fresh.

## Required Behaviors

- The antecedent, behavior, and consequence text entry fields are the dominant visual elements on the screen.
- The semantic section color coding (A/B/C grouping) is preserved — it aids comprehension and must not be removed.
- Preset chip rows are present but do not take up more vertical space than the text fields they support.
- The primary save action is reachable without scrolling past more than one full screen of content.
- Place and time fields are accessible within the same form without navigating to a separate screen.

## Acceptance Criteria

- On a 390×844 viewport, the first text entry field is visible without scrolling.
- The save action is reachable by scrolling no more than approximately one screen length.
- Preset chips are available as quick-entry shortcuts but do not occupy more space than the associated text field.
- The A/B/C color grouping is visually intact and correctly associates each section with its semantic color role from `DESIGN.md`.
- The screen validates at 375px and 390px without overflow or clipping.

## Out of Scope

- Changes to the ABC data model or what fields are captured.
- Changes to how incidents are stored or submitted to the API.
- Redesign of the preset chip data set.

## Doc Updates on Completion

- `docs/product-specs/behavior-tracking-abc.md` — if implementation makes concrete decisions about chip layout, field ordering, or section spacing not already specified there, record them as canonical.
- `docs/backlog/ui-feedback-general.md` — mark issue 5 (Behavioral Moment Create is too long) resolved.

## References

- `docs/product-specs/behavior-tracking-abc.md`
- `docs/architecture/frontend-interaction-principles.md` — low-friction recording, thumb-friendly actions
- `DESIGN.md` — semantic section color roles
- `docs/specs/shell-viewport-normalization.md`
