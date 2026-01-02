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
- Dev api: `npm run dev:api`
- Lint all: `npm run lint`
- Format: `npm run format`

## Conventions
- Keep workspace outputs under repo `dist/` only.
- Prefer workspace-relative scripts (`npm --workspace <name> run <script>`).
- Avoid changing build output paths unless explicitly requested.
- Frontend updates must follow the most modern Angular 21 approaches.
    - Use Signals where possible
    - Use experimental resources such as `httpResource`.

## Where to Look
- Frontend config: `frontend/angular.json`
- API TS config: `api/tsconfig.json`
- Repo scripts: `package.json`

## Notes
- Azure Functions run via `func start --javascript` (see `api/package.json`).
- If adding new outputs, keep them under `dist/<workspace>/`.
- For auth questions, read `docs/architecture/auth-flow.md` first.
- For feature work, follow `docs/feature/README.md`.
