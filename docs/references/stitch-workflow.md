# Stitch Workflow Reference

This document defines Stitch-specific implementation rules for TrackIt.

## Defaults

- TrackIt Stitch project: `projects/2002730124455423542`
- Use this project unless an explicit override is requested.

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
- `@stitch-last-sync` format must be `YYYY-MM-DD`.

## Migration Tracking

- Tracker location: `docs/references/stitch-migration.md`
- Audit command: `npm run audit:stitch-migration`
- Track all frontend components under `frontend/src/app/**/*.component.ts`
- Keep tracker status binary and consistent with metadata.

## Related Docs

- `docs/references/stitch-migration.md`
- `docs/runbooks/common-dev-tasks.md`
- `DESIGN.md`
