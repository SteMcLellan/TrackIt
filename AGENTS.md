# TrackIt Agent Guide

## Project Overview
- Monorepo with two npm workspaces:
  - `frontend/`: Angular app (Angular 21)
  - `api/`: Azure Functions (TypeScript)
- Unified build output:
  - `dist/frontend/`
  - `dist/api/`

## Key Commands
- Build all: `npm run build`
- Build frontend: `npm run build:frontend`
- Build api: `npm run build:api`
- Dev frontend: `npm run dev:frontend`
- Dev frontend (log to file, resets per rebuild): `npm run dev:frontend:log`
- Dev api: `npm run dev:api`
- Lint all: `npm run lint`
- Format: `npm run format`

## Frontend Workflow (Dev Log)
- When making frontend code changes, verify builds by checking `dist/frontend/dev-frontend.log`.
- If file is not found, ask user if they are running `npm run dev:frontend:log`
- If the log shows a build failure (TypeScript/template errors), correct errors and repeat until the log shows a successful build (e.g. "Application bundle generation complete").

## Multi-Agent Workflow (Coordinator + Workers)
- **Coordinator session (main worktree):**
  - Owns planning and decisions: active feature docs in `docs/feature/` and archived completed feature docs in `docs/feature/complete/`.
  - Breaks work into 1-story-at-a-time tasks and keeps the implementation checklist up to date.
  - Avoids editing the same code files workers are actively changing.
- **Worker sessions (separate worktrees):**
  - Implement code changes for assigned story scope only.
  - Validate changes locally (frontend via dev log; API via build) and report back what changed + how it was verified.
  - Minimize overlap: do not have multiple workers edit the same files simultaneously.

## Worktrees (Recommended for Parallel Agents)
- Use separate worktrees for parallel agents, grouped under `..\\TrackIt.wt\\<agent-id>\\` (e.g. `..\\TrackIt.wt\\a\\`, `..\\TrackIt.wt\\b\\`).
- Each worktree has its own `dist/`, so frontend build logs won't collide across worktrees.
- If multiple dev servers run at the same time, **frontend/API ports must not collide** (use the worker prompt's suggested port mapping or pick any unused ports).

## Coordination Files (Shared Across Worktrees)
- Use the shared folder `..\\TrackIt.wt\\agents\\` for coordination artifacts (handoffs, scratch notes, per-ticket checklists).
- This folder lives outside the repo and is not committed.
- Suggested ticket file naming (grouped by ticket id):
  - Coordinator-owned: `..\\TrackIt.wt\\agents\\ticket-<ticket-id>-spec.md`
  - Worker-owned: `..\\TrackIt.wt\\agents\\ticket-<ticket-id>-progress.md`
  - Include: story/task, files changed, verification evidence, and notes/risks.

## Ticket Protocol (One Ticket Per Agent)
- Each agent may have **at most one active ticket** at a time.
- Everyone may read all files in `..\\TrackIt.wt\\agents\\`.
- **Coordinator-owned file for a ticket (only coordinator writes):**
  - `..\\TrackIt.wt\\agents\\ticket-<ticket-id>-spec.md` (assignee + scope + acceptance + verification steps)
- **Worker-owned file for a ticket (only assigned worker writes):**
  - `..\\TrackIt.wt\\agents\\ticket-<ticket-id>-progress.md` (progress notes + final handoff + verification evidence)
- Coordinator never edits `ticket-<ticket-id>-progress.md`; workers never edit `ticket-<ticket-id>-spec.md`.
- Optional (recommended): coordinator also maintains `..\\TrackIt.wt\\agents\\active-tickets.md` as an index mapping `agent-id -> active ticket-id`.
- If you need to change something in a file you don’t own: write the request in your own file and ping the owner.
- Ticket file layout is enforced by convention: ticket files must follow the templates below so the coordinator can reliably parse status and the worker can reliably hand off.

### Template: `ticket-<ticket-id>-spec.md` (coordinator-owned)
```md
---
ticketId: <ticket-id>
kind: spec
owner: coordinator
assignee: <agent-id>
status: queued # queued|in_progress|ready_for_review|blocked|done
createdUtc: <YYYY-MM-DD>
updatedUtc: <YYYY-MM-DD HH:mm>
---

# Ticket <ticket-id> — <short title>

- Owner: coordinator
- Assignee: <agent-id> (<worker name>)
- Status: queued | in_progress | ready_for_review | blocked | done
- Created (UTC): <YYYY-MM-DD>
- Last updated (UTC): <YYYY-MM-DD HH:mm>

## Scope Recap
- <what changes for the user/system>

## Assumptions / Open Questions
- <anything to resolve before/during implementation>

## Technical Plan
- <implementation notes at the level needed for this ticket>

### Allowed changes / boundaries
- Allowed directories/files:
  - <list>
- Forbidden:
  - <list>

### Validation + auth (if applicable)
- <auth, input validation, data-model constraints>

### Testing approach
- Frontend: <e.g. dist/frontend/dev-frontend.log contains "Application bundle generation complete">
- API: <e.g. npm run build:api succeeds>

## Sequencing
1. <ordered steps (optional)>

## Story-Tracking Checklist
- [ ] <testable statement (done when all boxes are checked + verification passes)>
```

### Template: `ticket-<ticket-id>-progress.md` (worker-owned)
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
- Ticket lifecycle (default):
  1. Coordinator creates `ticket-<ticket-id>-spec.md` and assigns it (and updates `active-tickets.md` if used).
  2. Worker implements and keeps `ticket-<ticket-id>-progress.md` updated (mark clearly when “READY FOR REVIEW”).
  3. Coordinator validates (build/log checks) and marks the ticket “DONE” (and clears `active-tickets.md` if used).

## Conventions
- Keep workspace outputs under repo `dist/` only.
- Prefer workspace-relative scripts (`npm --workspace <name> run <script>`).
- Avoid changing build output paths unless explicitly requested.
- Frontend updates must follow the most modern Angular 21 approaches.
    - Use Signals where possible
    - Use experimental resources such as `httpResource`.
- Store and process all timestamps in UTC. Any local time display should be derived from UTC.
- Data modeling conventions (especially time/day fields): see `docs/architecture/data-modeling.md`.
- Cosmos client/container instances are cached at module scope; restart the function host to pick up env/config changes.

## Where to Look
- Active feature specs/plans: `docs/feature/`
- Completed feature archive: `docs/feature/complete/`
- Frontend config: `frontend/angular.json`
- API TS config: `api/tsconfig.json`
- Repo scripts: `package.json`

## Notes
- Azure Functions run via `func start --javascript` (see `api/package.json`).
- If adding new outputs, keep them under `dist/<workspace>/`.

## Feature Completion Workflow (Archive)
- When a feature is complete (all items checked in its `## Story-Tracking Checklist` and verification steps pass), the coordinator moves:
  - `docs/feature/<feature-name>.md` -> `docs/feature/complete/<feature-name>.md`
  - `docs/feature/<feature-name>.impl.md` -> `docs/feature/complete/<feature-name>.impl.md`
- Keep filenames stable (only the directory changes) so history and grepability stay consistent.
- New/active work should never be added under `docs/feature/complete/`.
