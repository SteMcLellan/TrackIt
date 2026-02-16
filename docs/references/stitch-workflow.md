# Stitch Workflow Reference

This document defines Stitch-specific implementation rules for TrackIt.

## Defaults

- TrackIt Stitch project: `projects/2002730124455423542`
- Use this project unless an explicit override is requested.

## Component Tier Model

Not every component needs a Stitch screen. Use this model to decide:

| Tier | What belongs here | Stitch involvement |
|---|---|---|
| **Screen** | Feature page components — each represents a distinct user-visible surface | Generate when needed, then implement from `DESIGN.md` |
| **Pattern** | Shared UI components (cards, chips, charts, forms, shell sub-pieces) | Capture in `DESIGN.md`; no individual Stitch screen |
| **Atom** | Icon components, skeletons, utility components | None — code only |

When starting a new feature, generate a Stitch screen only if the component is Screen tier.

## Design Source of Truth

- `DESIGN.md` is the stable reference for patterns, tokens, and shell specs.
- Stitch screens are **design inputs**, not live dependencies. Once patterns are synthesized into `DESIGN.md`, implement from `DESIGN.md`.
- The workflow is: **Stitch (explore) → DESIGN.md (synthesize) → Code (implement)**

## When to Use Stitch

Open Stitch when:

- Starting a new **Screen-tier** feature where the design hasn't been established
- Doing a significant **visual revision** to an existing screen
- Exploring **variants** before committing to a layout direction
- Brainstorming a **specific component or section** on an existing page (see Scratch Screen Workflow)

Do **not** open Stitch to:

- Implement Pattern or Atom tier components
- Re-sync a screen that hasn't had a design change
- Verify code correctness — use the running app for that

## Batch Design Sessions

Avoid ad-hoc Stitch usage mid-feature. Instead:

1. Before starting a feature area, run a design session: generate/edit all relevant screens at once.
2. Update `DESIGN.md` if new patterns emerge from the session.
3. Close Stitch and implement entirely from `DESIGN.md`.

## Scratch Screen Workflow

Use this workflow to brainstorm a specific component or page section using Stitch without affecting the rest of the page.

### When to use it

- You want to explore visual options for one component on an existing screen
- The target component does not yet have an established design in `DESIGN.md`
- You want variants before committing to an implementation

### Steps

1. **Generate a scratch screen.** Describe the full surrounding page so Stitch has context, then explicitly call out what you are exploring. Example prompt shape:

   > *"This is an [page name] screen with [brief description of overall layout]. I want to explore different treatments for [specific component or section] only."*

2. **Generate variants.** Run `generate_variants` on the scratch screen to get 2–3 alternatives.

3. **Identify new patterns.** Before implementing, determine whether the Stitch output introduces anything that belongs in `DESIGN.md`:
   - A new component shape or visual treatment
   - A new use of an existing color token
   - A new layout or spacing pattern
   - A new typography treatment

4. **Update `DESIGN.md` first.** If step 3 identified new patterns, add or update the relevant section of `DESIGN.md` before writing any component code. Do not implement ahead of the design record.

5. **Implement the target component only.** Scope the implementation plan and all code changes exclusively to the target component. Do not touch surrounding components, shared layout, or the shell — even if the scratch screen renders them differently.

6. **Discard the scratch screen.** Do not add `@stitch-*` metadata to the component. The screen was exploratory only.

### Scope isolation rule

> When implementing from a scratch screen, the implementation plan and all file changes are limited to the target component. Surrounding components visible in the Stitch screen are reference context only — never implementation targets.

### DESIGN.md update obligation

> Any new reusable visual pattern introduced by a scratch session **must** be recorded in `DESIGN.md` before the component code is finalized. If no new pattern is introduced, no `DESIGN.md` update is needed.

## Known Stitch Behaviors

- Edit one screen at a time with `edit_screens`; multi-screen edits may no-op.
- Screen titles may drift from prompt wording; title mismatch alone is not blocking.
- Use prompt enhancement when precise visual output is required.

## Required Metadata for Stitch-Converted Components

Add this block immediately above `@Component(...)`:

```typescript
/**
 * @stitch-project projects/2002730124455423542
 * @stitch-screen projects/2002730124455423542/screens/<screen-id>
 * @stitch-screen-title <screen title>
 * @stitch-status converted
 * @stitch-last-sync YYYY-MM-DD
 */
```

Rules:

- Metadata block is required for every Stitch-converted component.
- `@stitch-screen` must be a full Stitch resource name.
- `@stitch-status` must be `converted` when migrated.
- `@stitch-last-sync` records **when the code was initially derived from Stitch** — it is a provenance marker, not an active sync target. Do not update it unless the component is re-derived from a new or revised Stitch screen.

## Shell Parity Checklist

Use this before accepting a Stitch screen update:

1. Top app bar matches canonical class tokens, icon names, and SVG path geometry.
2. Bottom nav matches canonical container tokens, item order, icons, and active/inactive states.
3. Screen remains mobile-first at 390px width, with no horizontal overflow.

## Related Docs

- `docs/runbooks/common-dev-tasks.md`
- `DESIGN.md`
