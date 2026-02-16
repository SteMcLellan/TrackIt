# Timeline — Stitch Alignment

Last updated: 2026-02-15
Status: Ready to scope implementation

## Problem

The timeline feed deviates from the Stitch design in three areas: medication log cards expose raw internal IDs, daily reflection cards show numeric scores instead of human-readable labels, and reflection chips use a single color instead of per-facet semantic colors.

## Reference

- Stitch screen: `projects/2002730124455423542/screens/a166f2fb385e4f7484f507dc2a886165` (TrackIt Timeline Feed)
- Stitch screen: `projects/2002730124455423542/screens/e78a1a0531dc47e49bc20cf32001380c` (TrackIt Insights Dashboard)
- Component: `frontend/src/app/features/timeline/timeline.component.ts`
- Projectors: `api/src/shared/timeline/projectors.ts`

## Gap 1: Medication Log Cards Show Raw IDs

**Current**: Subtitle shows `Hydroxyzine • as-needed-1771175693309-bd4ba851` or `Sertraline • dose-1`.

**Stitch**: Shows `Morning Dosage • Methylphenidate 10mg` or `Afternoon Dosage • Methylphenidate 5mg`.

**Root cause**: Two issues in `projectMedicationLogToEventIndex()`:
- `summary.subtitle` is built as `${medication?.name} • ${log.occurrenceKey}` — the `occurrenceKey` is an internal scheduling key, not a display label.
- When `medication` isn't passed to the projector, `medicationName` is undefined and the frontend falls back to raw `medicationId`.

**Fix direction**:
- **Backend projector**: Replace `occurrenceKey` with a human-readable daypart label derived from `logLocalTime` (Morning, Midday, Afternoon, Evening — same logic as `medicationDaypartFromLocalTime` on the frontend). Store medication name + dosageText in summary so the card can show `Morning • Methylphenidate 10mg`.
- **Frontend**: The `occurrenceLabel()` and `medicationLabel()` methods already attempt this transformation, but they're working around data that should have been projected correctly. Once the projector provides clean data, simplify the frontend to just render `summary` fields.
- **Existing events**: Old eventIndex rows will still have raw `occurrenceKey` in subtitle. The frontend should keep its fallback logic for backwards compatibility, but new projections should produce clean data.

## Gap 2: Daily Reflection Cards Show Raw Scores

**Current**: Subtitle shows `Mood 65 | Focus 65 | Energy 85 | Sleep 60`. Chips show `Mood: medium`, `Focus: medium`.

**Stitch**: Shows a prose journal snippet ("Had a great start to the day...") with mood-specific chips like `Focused`, `High Energy`.

**Per `docs/backlog/daily-reflection-scoring.md`**: Numeric scores should be hidden from parents. Parents see bucket labels (Struggling, Steady, Thriving, etc.) that are dimension-specific — not generic "medium"/"high".

**Root cause**:
- `projectDailyReflectionToEventIndex()` builds subtitle as `Mood ${score} | Focus ${score} | ...` — exposes raw numbers.
- `toScoreBand()` produces generic bands (`very_low`, `low`, `medium`, `high`) instead of dimension-specific labels from the scoring spec.
- The frontend `reflectionChipLabels()` reads these generic bands and displays `Mood: medium` instead of the spec's labels like `Steady` or `Drifting`.

**Fix direction**:
- **Backend projector**: Change subtitle to `journalNotePreview` (truncated journal note) when available, or omit subtitle entirely if no journal note exists. The dimension summary belongs in chips, not the subtitle.
- **Backend projector**: Use dimension-specific bucket labels from the scoring spec for tags (e.g. `mood_band:steady` instead of `mood_band:medium`). This requires a label lookup per dimension per score range.
- **Frontend**: Update `reflectionChipLabels()` to display just the dimension-specific label (e.g. `Steady` instead of `Mood: medium`), paired with its semantic color.

### Dimension-Specific Bucket Labels (from scoring spec)

| Score Range | Mood | Focus | Energy | Sleep |
|-------------|------|-------|--------|-------|
| 0-19 | Struggling | Scattered | Drained | Rough Night |
| 20-39 | Irritable | Drifting | Sluggish | Restless |
| 40-59 | Steady | Typical | Steady | Fine |
| 60-79 | Upbeat | Dialed In | Buzzing | Solid |
| 80-100 | Thriving | Locked In | Wired | Refreshed |

## Gap 3: Reflection Chips Lack Per-Facet Colors

**Current**: All reflection chips use `chip-sky` (uniform light blue).

**Stitch insights dashboard**: Each facet has a distinct semantic color:

| Facet | Color | Hex |
|-------|-------|-----|
| Mood | Violet | `#8b5cf6` (Electric Violet) |
| Focus | Emerald | `#10b981` (Vital Emerald) |
| Sleep | Blue | `#3b82f6` / `#0ea5e9` (Azure family) |
| Energy | Amber | `#f59e0b` (Energetic Amber) |

**Fix direction**:
- **Frontend**: Add chip color variants (`chip-violet`, `chip-emerald`, `chip-amber`) alongside existing `chip-sky`. Map each facet to its color in `reflectionChipLabels()` or a new helper that returns `{ label, colorClass }`.
- **DESIGN.md**: Add an explicit "Reflection Facet Color Map" section documenting the 1:1 mapping. Currently DESIGN.md lumps "mood / sleep" under Vital Emerald, which contradicts the Stitch design where mood=violet and sleep=blue.

## DESIGN.md Gap: Missing Facet Color Mapping

DESIGN.md's "Core Semantic Colors" section says:
- Vital Emerald = "Wellness / mood / sleep positive indicators"
- Electric Violet = "Behavioral moment (ABC) tagging"
- Energetic Amber = "Energy / caution metric indicators"

This conflicts with the Stitch insights dashboard where:
- Mood is violet (not emerald)
- Focus is emerald (not mentioned)
- Sleep is azure/blue (not emerald)
- Energy is amber (matches)

**Action**: Update DESIGN.md to add a facet color map and correct the semantic role descriptions. Proposed addition:

```markdown
### Reflection Facet Colors

| Facet | Color | Hex | Chip Background |
|-------|-------|-----|-----------------|
| Mood | Electric Violet | #8b5cf6 | rgba(139, 92, 246, 0.14) |
| Focus | Vital Emerald | #10b981 | rgba(16, 185, 129, 0.14) |
| Sleep | Sky Azure | #0ea5e9 | rgba(14, 165, 233, 0.14) |
| Energy | Energetic Amber | #f59e0b | rgba(245, 158, 11, 0.14) |
```

## Implementation Order

1. **DESIGN.md** — Add facet color map (no code change, unblocks everything else).
2. **Backend projector** — Fix medication log subtitle and daily reflection subtitle/tags.
3. **Frontend chips** — Add per-facet color variants and dimension-specific labels.
4. **Frontend cleanup** — Simplify `occurrenceLabel()` and `medicationLabel()` once projector data is clean.

## Open Questions

- **Backfill existing eventIndex rows?** Old projections have raw `occurrenceKey` and generic bands. Options: live with frontend fallback logic, or run a one-time migration to re-project.
- **Score band boundary alignment**: The projector uses `toScoreBand()` with boundaries at 24/49/74. The scoring spec uses 19/39/59/79. These should match — the spec boundaries are authoritative.
- **Stitch hex drift**: The insights dashboard uses `#7f13ec` for mood/violet while the timeline uses `#8b5cf6`. Need to pick one canonical violet for DESIGN.md. Recommend `#8b5cf6` (Electric Violet) since it's already documented.

## Related Docs

- `docs/references/stitch-workflow.md` — Design source of truth rules and implementation workflow (Stitch → DESIGN.md → Code)
- `docs/backlog/daily-reflection-scoring.md` — Scoring model, bucket labels, UX spec
- `DESIGN.md` — Design system colors and component styles
- `docs/architecture/data-modeling.md` — Event index and timeline data model
