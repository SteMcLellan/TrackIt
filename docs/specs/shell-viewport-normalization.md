# Shell Viewport Normalization

## Summary

Several major screens expand to full content height rather than constraining themselves to a viewport-sized shell with a scrollable content region. This makes the bottom nav behave as page content instead of a fixed navigation element, violating the canonical shell contract.

## Job to Be Done

When I navigate between screens in TrackIt, I want the top bar and bottom nav to remain fixed in place, so I can always access navigation without scrolling and so every screen feels like part of the same consistent app.

## Affected Screens

- `Daily Reflection`
- `Medications Dashboard`
- `Timeline`
- `Behavioral Moment Create`
- `Profile Dashboard`

## Required Behaviors

- Every screen renders inside `ShellComponent`, which owns the top bar, content area, and bottom nav.
- The content `<main>` region is the scroll container — page components must not set a fixed height or expand the shell's outer bounds.
- The bottom nav is always visible at the bottom of the viewport regardless of content length.
- The top bar is always sticky at the top of the viewport.
- Page components use `height: auto` and let content flow naturally within `<main>`.
- `<main>` includes `padding-bottom` sufficient to clear the fixed bottom nav and `env(safe-area-inset-bottom)`.

## Acceptance Criteria

- On each affected screen, the bottom nav does not scroll out of view when the page content is longer than the viewport.
- On each affected screen, the top bar does not scroll out of view.
- No page component renders its own top bar or bottom nav elements.
- Screens validate at 375px and 390px widths without horizontal overflow or hidden controls.

## Out of Scope

- Changes to the visual design of the top bar or bottom nav components.
- Behavioral changes to the content of the affected screens (addressed in separate specs).
- Login/sign-in screen, which intentionally opts out of the shell.

## Doc Updates on Completion

- `docs/architecture/page-shell.md` — remove the "Migration from Current Implementation" section once all affected screens are migrated and the old `AppComponent` shell pattern is gone.
- `docs/backlog/ui-feedback-general.md` — mark issue 1 (Shell and viewport consistency) resolved.

## References

- `docs/architecture/page-shell.md`
- `docs/architecture/frontend-interaction-principles.md`
