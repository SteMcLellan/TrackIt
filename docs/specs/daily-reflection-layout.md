# Daily Reflection Layout Fix

## Summary

The Daily Reflection screen has a clipping defect: the internal cards area is taller than its parent content frame, and the action area containing `Save Reflection` and `Cancel` is clipped out of the content container. This is a correctness issue, not a design preference — interactive elements must not be hidden or unreachable.

## Job to Be Done

When I fill out my daily reflection, I want to always be able to see and tap the save and cancel actions, so I can complete or discard the reflection without hunting for controls that are off screen.

## Required Behaviors

- The `Save Reflection` and `Cancel` actions are visible and tappable without horizontal or vertical overflow.
- The cards area scrolls inside the shell's fixed-height content region — it does not expand the shell boundary.
- The action bar (`Save Reflection` / `Cancel`) is anchored such that it remains reachable as the user scrolls through the card content, or it is positioned below the scrollable content and above the bottom nav.
- No interactive element in the Daily Reflection screen is clipped by its parent container.

## Acceptance Criteria

- On a 390×844 viewport, both `Save Reflection` and `Cancel` are fully visible and tappable without scrolling past them.
- If the content cards exceed the available scroll height, the action bar does not disappear below the visible area.
- The screen passes the standard 375px and 390px viewport validation checks (no overflow, no hidden controls).
- The shell's top bar and bottom nav remain fixed in place (see `shell-viewport-normalization.md`).

## Out of Scope

- Visual redesign of the Daily Reflection form cards.
- Changes to the reflection data model or scoring logic.

## Doc Updates on Completion

- `docs/backlog/ui-feedback-general.md` — mark issue 2 (Daily Reflection clipping defect) resolved.

## References

- `docs/architecture/frontend-interaction-principles.md` — no clipped or off-screen interactive elements
- `docs/architecture/page-shell.md` — page content contracts
- `docs/product-specs/daily-reflection-scoring.md`
- `docs/specs/shell-viewport-normalization.md`
