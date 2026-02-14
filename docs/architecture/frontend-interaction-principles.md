# Frontend Interaction Principles

This document defines mobile-first UI behavior requirements for TrackIt.

## Core Principles

1. Mobile-first design: design for small screens first, then scale up.
2. Quick access: surface key information with minimal taps.
3. Low-friction recording: optimize entry flows for rapid capture.
4. Thumb-friendly actions: put primary actions in easy reach on mobile.

## Required Interaction Patterns

- Use a bottom sheet for list-level "Add" actions where users add related entries.
- Use read-only display values by default for settings/profile forms.
- Reveal inputs and Save actions only while editing.
- Use semantic section color roles from `DESIGN.md`.

## Mobile Layout Rules

- No horizontal scrolling.
- No clipped or off-screen interactive elements.
- Use responsive sizing (`width: 100%`, `max-width: 100%` where needed).
- Avoid fixed widths that break at narrow viewports.
- Ensure touch targets are at least `44x44`.

## Frontend Validation Expectations

Validate UI updates at:

- `375px` width minimum
- `390px` target width (iPhone 14 class)

Check for:

- Overflow or horizontal scrollbars
- Hidden controls
- Correct text wrapping
- Adequate target sizing for taps

## Related Docs

- `DESIGN.md`
- `docs/architecture/page-shell.md`
- `docs/architecture/frontend-engineering-conventions.md`
