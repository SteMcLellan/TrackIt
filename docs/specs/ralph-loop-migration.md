# Ralph Loop Migration: docs/specs → docs/**/*.md

## Context

The ralph loop currently reads `docs/specs/*` as its planning and implementation scope. We are removing that folder and broadening the loop to use all of `docs/**/*.md` as its knowledge base, with `IMPLEMENTATION_PLAN.md` as the explicit scope boundary.

Before removing `docs/specs/`, content unique to four specs must be merged into the appropriate `docs/product-specs/` files. Remaining specs are either superseded, already implemented, or already covered by architecture docs and can be deleted without migration.

This spec is the last occupant of `docs/specs/` and deletes itself as part of Phase 3.

---

## Phase 1 — Merge content gaps into docs/product-specs/

### 1a. Merge `medications-summary-2.md` into `docs/product-specs/medication-command-center.md`

Content to add: how interval medications contribute to the adherence summary on the `/medications` page summary card.

- Interval medications with `dueState` of `due` or `overdue` are counted in the "remaining" total alongside scheduled pending doses.
- Interval medications with `dueState` of `early` are excluded from the remaining count.
- Adherence copy on the Medications summary card uses the same semantics as the Insights compact card:
  - "All on track" when no scheduled pending doses and no interval due/overdue items remain
  - "N remaining" when any actionable items exist
  - "None scheduled" when no actionable doses exist at all
- Nearest-interval guidance appears on the Medications summary card:
  - "Next interval due today"
  - "Next interval due in N days"
  - "Next interval overdue by N days"

### 1b. Merge `behavior-incidents-2.md` into `docs/product-specs/behavior-tracking-abc.md`

Two areas of content to add:

**Filter contract (API):** The list endpoint (`GET .../incidents`) accepts `startDate` and `endDate` as `YYYY-MM-DD` local date strings. This is the canonical contract — matching every other date-range endpoint. Any reference to `fromUtc`/`toUtc` in the product spec or codebase is incorrect and should be replaced.

**Frontend routes** (if not already documented in the product spec):
- `/incidents` — list view with date-range and function filters, paginated newest to oldest. Each row: date/time, ABC summary line, function label.
- `/incidents/:id` — detail view showing A, B, C, place, function, and date/time; Edit and Delete actions; Delete requires confirmation.
- `/incidents/new` — create incident.

### 1c. Merge `daily-reflection-2.md` into `docs/product-specs/daily-reflection-scoring.md`

Content to add: the score commitment model for the reflection form.

- When a new reflection form opens, the Balanced bucket is visually pre-highlighted on each dimension as a guide, but no dimension is committed.
- The first time a user taps any bucket on a dimension, that dimension becomes committed using the midpoint for that bucket (10, 30, 50, 70, or 90).
- Dimensions never tapped are not committed and must be sent as `null` to the API (not `50`).
- Saving with zero committed dimensions shows inline validation: "Select at least one dimension to save."
- When loading an existing reflection, `null` dimensions show no bucket selected; stored values show the correct bucket selected.
- The PUT body sends `null` explicitly for dimensions being cleared; untouched dimensions on a new form are omitted.

### 1d. Create `docs/product-specs/insights-dashboard.md`

This content has no existing home and must become a new file. Content:

- **Today's reflection card** appears on the Insights page below the hero phrase / weekly summary header area, above the weekly rhythm dimension cards.
- **Logged state:** when today's reflection exists, show committed dimension bucket labels (e.g. "Mood: Steady · Focus: Dialed In · Sleep: Fine"). Null (uncommitted) dimensions are omitted. Card is tappable; navigates to `/daily-reflection` in edit mode.
- **Not-logged state:** show a prompt ("How is [participant name] doing today?") with a "Log today's reflection" CTA that navigates to `/daily-reflection`.
- **Data:** uses data already loaded for the weekly summary window; no additional API call required when today falls within that window.

---

## Phase 2 — Update PROMPT_plan.md and PROMPT_build.md

### PROMPT_plan.md

Replace every occurrence of `docs/specs/*` with `docs/**/*.md`.

Replace the scope rule:
> "Treat `docs/specs/*` as the planning scope. Other repo docs may be used as reference, but do NOT create plan items from them unless the active spec requires it. If a required spec is missing or inconsistent, update `docs/specs/FILENAME.md` and record the follow-up work in @IMPLEMENTATION_PLAN.md using a subagent."

With:
> "Treat `IMPLEMENTATION_PLAN.md` as the planning scope. Use `docs/**/*.md` as the knowledge base. Do NOT generate new plan items from architecture or reference docs unless they describe unimplemented behavior. If a required spec is missing, create it in `docs/product-specs/` and record the follow-up work in @IMPLEMENTATION_PLAN.md using a subagent."

### PROMPT_build.md

Replace every occurrence of `docs/specs/*` with `docs/**/*.md`.

Replace the scope rule:
> "Treat `docs/specs/*` as the implementation scope; other docs are reference-only unless the active spec requires them."

With:
> "Treat `IMPLEMENTATION_PLAN.md` as the implementation scope; use `docs/**/*.md` as reference."

---

## Phase 3 — Update supporting docs and AGENTS.md, then delete docs/specs/

### AGENTS.md

- Remove `docs/specs/` from the Agent Lookup Order (currently step 3); renumber remaining steps.
- Remove the note "Do not update the doc map for individual files added to `docs/specs/` — that folder is self-navigable and does not need to be enumerated here." Replace with an equivalent note pointing to `docs/product-specs/`.
- Update the doc map in the Repository Doc Map section to remove the `docs/specs/` entry.

### docs/references/development-commands.md

Replace:
> "Ralph specs live in `docs/specs/`, and the loop always reads `PROMPT_plan.md` or `PROMPT_build.md` from the repo root based on `-Mode`."

With:
> "Ralph uses `docs/**/*.md` as its knowledge base; scope is tracked in `IMPLEMENTATION_PLAN.md`. The loop always reads `PROMPT_plan.md` or `PROMPT_build.md` from the repo root based on `-Mode`."

### docs/runbooks/common-dev-tasks.md

In the "Run Ralph Loop" section, replace step 1:
> "Add or update requirement specs in `docs/specs/`."

With:
> "Add or update specs in `docs/product-specs/` (feature specs) or `docs/architecture/` (system design)."

### Delete docs/specs/

Delete all remaining files in `docs/specs/` including this file. At this point the folder should be empty.

---

## Acceptance Criteria

- [ ] `docs/product-specs/medication-command-center.md` documents interval adherence counting and nearest-interval guidance copy
- [ ] `docs/product-specs/behavior-tracking-abc.md` documents `startDate`/`endDate` filter params (no reference to `fromUtc`/`toUtc`)
- [ ] `docs/product-specs/daily-reflection-scoring.md` documents the null score commitment model and pre-highlight behavior
- [ ] `docs/product-specs/insights-dashboard.md` exists and covers the today's reflection card spec
- [ ] `PROMPT_plan.md` contains no reference to `docs/specs/`
- [ ] `PROMPT_build.md` contains no reference to `docs/specs/`
- [ ] Both prompts reference `docs/**/*.md` as the knowledge base and `IMPLEMENTATION_PLAN.md` as scope
- [ ] `AGENTS.md` Agent Lookup Order contains no `docs/specs/` entry
- [ ] `docs/references/development-commands.md` reflects the new knowledge base path
- [ ] `docs/runbooks/common-dev-tasks.md` Ralph Loop step 1 points to `docs/product-specs/`
- [ ] `docs/specs/` directory does not exist
- [ ] `npm run build` passes
