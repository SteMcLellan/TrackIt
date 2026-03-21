# UI Feedback: General

Status: Exploring follow-up design cleanup
Last updated: 2026-03-09

## Context

This note captures general feedback on the frames in [components.pen](C:/Users/mclel/repos/TrackIt/docs/design/components.pen).

Related docs:
- [docs/architecture/frontend-interaction-principles.md](C:/Users/mclel/repos/TrackIt/docs/architecture/frontend-interaction-principles.md)
- [docs/architecture/page-shell.md](C:/Users/mclel/repos/TrackIt/docs/architecture/page-shell.md)
- [docs/product-specs/behavior-tracking-abc.md](C:/Users/mclel/repos/TrackIt/docs/product-specs/behavior-tracking-abc.md)
- [docs/product-specs/medication-command-center.md](C:/Users/mclel/repos/TrackIt/docs/product-specs/medication-command-center.md)

## Summary

The current frame set has a strong visual direction and generally uses the TrackIt color system well, especially on Insights, Timeline, and Profile. The main issues are structural rather than aesthetic: several screens are not using the canonical shell model consistently, at least one screen has clipped content, and a few action-heavy screens need clearer hierarchy for primary tasks.

## Strengths

- `Insights Dashboard` is the strongest overall frame. It is scannable, uses semantic color well, and keeps medication information lightweight enough to preserve the read-oriented intent of the page.
- `Timeline` groups content clearly. The day sections, chips, and card rhythm make the feed easy to skim.
- `Profile Dashboard` is structurally aligned with the product guidance to show read-only information by default with clear edit entry points.
- The top bar and bottom nav components are visually coherent and provide a solid base design language for the mobile shell.

## Issues

### 1. Shell and viewport consistency — **Resolved**

- ~~The reusable `Shell Component` is viewport-sized at `390x844`, but multiple screen frames expand to full content height instead of preserving a viewport-sized shell with a scrollable content region.~~
- ~~This makes the bottom nav behave like part of the page content rather than a fixed navigation element.~~
- Fixed: `ShellComponent` `:host` and `.shell` changed from `min-height: 100dvh` to `height: 100dvh; overflow: hidden`. `<main>` now has `overflow-y: auto` as the scroll container.

### 2. Daily Reflection clipping defect — **Resolved**

- ~~`Daily Reflection` has an actual layout problem, not just a design preference issue.~~
- ~~The internal cards area is taller than its parent content frame, and the action area containing `Save Reflection` / `Cancel` is clipped out of the content container.~~
- ~~This violates the mobile layout guidance to avoid clipped or off-screen interactive elements in [docs/architecture/frontend-interaction-principles.md](C:/Users/mclel/repos/TrackIt/docs/architecture/frontend-interaction-principles.md).~~
- Fixed: `:host` set to `height: 100%`; `.page` made flex column (`height: 100%; display: flex; flex-direction: column`); `.cards` given `flex: 1; min-height: 0; overflow-y: auto` so cards scroll while action bar stays visible below.

### 3. Top bar tap target sizing — **Resolved**

- ~~The top bar action buttons are `36x36`.~~
- ~~Repo guidance requires touch targets to be at least `44x44`.~~
- Fixed: `.icon-button` changed from `width/height: 2.25rem` (36px) to `min-width/min-height: 2.75rem` (44px).

### 4. Medications screen lacks enough action emphasis

- The medications screen currently reads more like a sparse summary view than a dedicated action surface.
- The product spec expects this route to support a swipe-first medication workflow, scheduled and as-needed sections, interval guidance, and time editing.
- The current structure does not yet communicate that level of operational depth.

### 5. Behavioral Moment Create is visually coherent but too long

- The semantic section colors are effective and the A/B/C grouping is clear.
- The screen still feels too tall before the primary save action appears.
- The design currently gives substantial space to preset chips and decorative framing while making the actual written incident details feel secondary.
- That is risky for a flow whose core job is capturing meaningful antecedent, behavior, consequence, place, and time details.

### 6. Profile action hierarchy is crowded — **Resolved**

- ~~`Profile Dashboard` is one of the cleaner screens overall, but the caregiver invite area is visually dense.~~
- ~~Invite link, expiry, copy, share, and member list information compete for attention in a small area.~~
- ~~The card would benefit from a more obvious primary action hierarchy.~~
- Fixed: "Copy Invite Link" is now the primary CTA (filled violet pill). "Share" is a secondary ghost-violet button. "Regenerate link" is a subordinate text link below. When no invite exists, "Generate Invite Link" is the primary CTA. Regenerate removed from the card header.

## Frame Notes

### Insights Dashboard

- Keep the overall structure.
- Use this as the reference point for scannability and section pacing.

### Daily Reflection

- Fix the clipping issue first.
- Rework the frame so the content scrolls inside a fixed-height shell.
- Keep the action bar consistently reachable and visually attached to the task completion state.

### Medications Dashboard

- Increase the sense of active workflow.
- Make scheduled and as-needed interactions more explicit in the composition.
- Preserve the summary card, but do not let it dominate a route meant for logging and management.

### Timeline

- Keep the overall direction.
- Align the shell behavior with the canonical viewport model.

### Behavioral Moment Create

- Reduce vertical sprawl.
- Shift more emphasis toward the text-entry portions of the ABC form.
- Keep the semantic color coding, but use it to support hierarchy rather than lengthen the page.

### Profile Dashboard

- Keep the read-only-first approach.
- Simplify the caregiver access card so the primary next action is clearer.

## Recommended Follow-up

1. Normalize all major screens to the canonical shell and viewport height.
2. ~~Fix `Daily Reflection` clipping before any visual polish work.~~ ✓ Resolved.
3. ~~Increase top bar touch targets to `44x44`.~~ ✓ Resolved.
4. Rework `Medications Dashboard` to better match the dedicated logging workflow in the medication command center spec.
5. Compress `Behavioral Moment Create` and strengthen emphasis on the actual incident-entry fields.
