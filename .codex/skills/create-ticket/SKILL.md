---
name: create-ticket
description: Create and assign a worker ticket in the TrackIt multi-agent workflow (agents a/b/c). Use when acting as coordinator and asked to “create a ticket”, “assign agent a/b/c”, or “make the next worker ticket” for a feature story. Writes the coordinator-owned ticket spec file and (optionally) updates the active ticket index.
---

# Create Ticket Skill (Coordinator)

Use this skill to produce a single, well-scoped worker ticket that can be executed without write conflicts.

## Workflow

### 1) Pick the story and confirm it’s active work
1. Find the next story to implement in `docs/feature/<feature-name>.impl.md`.
2. Confirm the feature docs are in `docs/feature/` (not `docs/feature/complete/`). If they’re archived, stop and confirm the feature is being reopened.

### 2) Choose a ticket id and assignee
1. Pick a stable ticket id (recommended):
   - `<feature>-S<story-number>` (example: `home-landing-page-S3`)
2. Choose an assignee `a` / `b` / `c`.
3. Enforce “one ticket per agent”: if the assignee already has an active ticket, reassign or wait.

### 3) Write the coordinator-owned ticket spec
1. Create `..\\TrackIt.wt\\agents\\ticket-<ticket-id>-spec.md`.
2. Use the required spec template from `AGENTS.md` (Ticket Protocol section).
3. In the spec, include:
   - A single story focus (or a narrowly bounded sub-scope of one story).
   - Explicit allowed directories/files and forbidden areas.
   - Concrete acceptance checklist items (testable).
   - Verification steps (frontend log and/or api build).

### 4) (Optional) Update the active ticket index
If you maintain an index file, update:
- `..\\TrackIt.wt\\agents\\active-tickets.md` with `agent-id -> ticket-id` (and basic status).

### 5) Hand off cleanly
1. Tell the worker the ticket id and assignee.
2. Remind the worker:
   - They write `..\\TrackIt.wt\\agents\\ticket-<ticket-id>-progress.md` (using the template in `AGENTS.md`).
   - They set `Status: ready_for_review` when done.

## Rules
- Coordinator never edits `..\\TrackIt.wt\\agents\\ticket-<ticket-id>-progress.md`.
- Tickets must be independently deliverable and have explicit boundaries.
