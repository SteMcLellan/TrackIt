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
  - Owns planning and decisions: `docs/feature/*.md`, `docs/feature/*.impl.md`, and coordination notes.
  - Breaks work into 1-story-at-a-time tasks and keeps the implementation checklist up to date.
  - Avoids editing the same code files workers are actively changing.
- **Worker sessions (separate worktrees):**
  - Implement code changes for assigned story scope only.
  - Validate changes locally (frontend via dev log; API via build) and report back what changed + how it was verified.
  - Minimize overlap: do not have multiple workers edit the same files simultaneously.

## Worktrees (Recommended for Parallel Agents)
- Use separate worktrees for parallel agents, grouped under `..\\TrackIt.wt\\<agent-id>\\` (e.g. `..\\TrackIt.wt\\a\\`, `..\\TrackIt.wt\\b\\`).
- Each worktree has its own `dist/`, so frontend build logs won’t collide across worktrees.
- If multiple dev servers run at the same time, **frontend/API ports must not collide** (use the worker prompt’s suggested port mapping or pick any unused ports).

## Coordination Files (Shared Across Worktrees)
- Use the shared folder `..\\TrackIt.wt\\agents\\` for coordination artifacts (handoffs, scratch notes, per-ticket checklists).
- This folder lives outside the repo and is not committed.
- Suggested handoff file naming:
  - `..\\TrackIt.wt\\agents\\handoff-<ticket-id>.md`
  - Include: story/task, files changed, verification evidence, and notes/risks.

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
- Frontend config: `frontend/angular.json`
- API TS config: `api/tsconfig.json`
- Repo scripts: `package.json`

## Notes
- Azure Functions run via `func start --javascript` (see `api/package.json`).
- If adding new outputs, keep them under `dist/<workspace>/`.
