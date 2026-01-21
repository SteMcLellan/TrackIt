---
name: work-ticket
description: Execute exactly one coordinator-assigned worker ticket in the TrackIt multi-agent workflow (agents a/b/c). Use when you are assigned a ticket, asked to "work ticket <id>", or asked "pick up the next ticket". Produces progress + verification evidence in the worker-owned ticket progress file.
---

# Work Ticket Skill

Use this skill to implement **exactly one** coordinator-issued ticket and hand it back cleanly for review (without write conflicts).

## Workflow

### 1) Identify yourself + your ticket
1. Determine your agent id (`a`/`b`/`c`) from your worktree path (`..\\TrackIt.wt\\a\\`, etc.).
2. Open the coordinator-owned spec:
   - `..\\TrackIt.wt\\agents\\ticket-<ticket-id>-spec.md`
3. Create/open the worker-owned progress file:
   - `..\\TrackIt.wt\\agents\\ticket-<ticket-id>-progress.md`
   - If it doesn't exist, create it using the template defined below.

### 2) Confirm boundaries before coding
1. Read the ticket's "Allowed changes / boundaries".
2. If you need to go out of scope, stop and ask the coordinator in the progress file (don't change the spec).
3. If the feature docs are under `docs/feature/complete/`, stop and confirm the feature is being reopened (don't edit archived docs by default).

### 3) Implement and keep the progress file current
1. Implement only what the ticket assigns.
2. Log progress with UTC timestamps.
3. Copy the ticket checklist into your progress file and check items off as you complete them.
4. Keep the progress YAML frontmatter up to date (this is what drives the derived active ticket index):
   - Set `status: in_progress` when you start actual work.
   - Update `updatedUtc` (UTC, `YYYY-MM-DD HH:mm`) whenever you make meaningful progress or become blocked.
   - Keep `branch` and `headCommit` current after commits.

### 4) Verify and hand back
1. Verify what applies:
   - Frontend changes: keep `npm run dev:frontend:log` running; confirm `dist/frontend/dev-frontend.log` shows "Application bundle generation complete".
   - API changes: run `npm run build:api`.
2. Record verification evidence in the progress file.
3. Set `status: ready_for_review` in frontmatter (and the human-readable body status if present) and hand back to the coordinator.

## Rules
- One ticket at a time.
- Don't self-assign stories in multi-agent mode; work from the coordinator's ticket spec.
- Don't edit coordinator-owned files: `..\\TrackIt.wt\\agents\\ticket-<ticket-id>-spec.md` (or `docs/feature/*` plans) unless explicitly instructed.

## Output Expectations
- Keep `..\\TrackIt.wt\\agents\\ticket-<ticket-id>-progress.md` as the source of truth for what you did + verification.
- Hand back with `status: ready_for_review`, plus files changed and verification evidence.

## Reference Form: ticket-<ticket-id>-progress.md

```md
---
ticketId: <ticket-id>
kind: progress
owner: worker
agent: <agent-id>
status: in_progress # in_progress|ready_for_review|blocked|done
updatedUtc: <YYYY-MM-DD HH:mm>
branch: agent/<agent-id>
headCommit: <sha>
verification:
  notes: <short string>
---

# Ticket <ticket-id> — progress

- Owner: worker <agent-id> (<worker name>)
- Status: in_progress | ready_for_review | blocked | done
- Last updated (UTC): <YYYY-MM-DD HH:mm>

## Scope Recap
- <copy from spec for quick reference (optional)>

## Progress Log
- <YYYY-MM-DD HH:mm UTC> <what changed / what you tried>

## Story-Tracking Checklist (copied from spec)
- [ ] <copy checklist items here and mark off as you go>

## Verification
- Frontend: <paste key log lines or reference log path>
- API: <what command ran + outcome>

## Questions / Requests to Coordinator
- <blocked items or out-of-scope requests>

## Final Handoff (when ready)
- Story/task:
- Files changed:
- Verification:
- Notes/risks:
```
