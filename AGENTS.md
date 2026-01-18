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
