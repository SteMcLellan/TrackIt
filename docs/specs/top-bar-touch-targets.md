# Top Bar Touch Target Sizing

## Summary

The top bar action buttons (notifications and account circle) are currently sized at `36x36`. Repo guidance requires touch targets to be at least `44x44`. The controls look clean but are too small for reliable mobile use.

## Job to Be Done

When I tap the notifications or account button in the top bar, I want a large enough tap target that I can reliably hit it on the first attempt, so I can navigate quickly without mis-taps or frustration on a small screen.

## Required Behaviors

- The notifications button and account circle button each have a minimum touch target size of `44x44` CSS pixels.
- The visual appearance of the buttons may remain close to the current design — the touch target area can extend beyond the visible icon via padding.
- The `size-9` Tailwind class (`36×36`) used for the button elements must be replaced or supplemented to meet the 44px minimum.

## Acceptance Criteria

- Each button in `TopBarComponent` has a rendered hit area of at least `44×44` CSS pixels on 375px and 390px viewports.
- The top bar does not change its overall height or layout in a way that breaks the shell's sticky behavior.
- The visual design remains consistent with `DESIGN.md` tokens — use padding adjustments rather than changing icon or background size where possible.

## Out of Scope

- Changes to the icons, colors, or functionality of the top bar buttons.
- Adding new buttons or nav items to the top bar.

## Doc Updates on Completion

- `docs/architecture/page-shell.md` — update the `TopBarComponent` design tokens to replace `size-9` with whatever Tailwind classes implement the corrected 44px touch target, so the doc reflects the as-built implementation.
- `docs/backlog/ui-feedback-general.md` — mark issue 3 (Top bar tap target sizing) resolved.

## References

- `docs/architecture/frontend-interaction-principles.md` — touch targets must be at least 44×44
- `docs/architecture/page-shell.md` — `TopBarComponent` design tokens
- `DESIGN.md`
