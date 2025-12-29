# Frontend Upgrade Plan: Angular 17 -> Angular 21

## Goal
Upgrade the frontend app from Angular 17.x to Angular 21.x with minimal regressions, keeping build, serve, and test tooling working.

## Current State (from repo)
- Frontend package file: `frontend/package.json` uses Angular 17.3 and TypeScript ~5.4.
- Angular CLI config: `frontend/angular.json` uses `@angular-devkit/build-angular:browser` and `dev-server`.
- Scripts: `ng serve`, `ng build`, `ng test`, `ng lint`.

## Upgrade Strategy (incremental)
Angular supports incremental upgrades; go version-by-version to reduce breakage.

### 1) Preflight
- Confirm current Node/npm versions and compare with Angular 21 requirements (Angular Update Guide).
- Ensure clean working tree and lockfile is up to date (`frontend/package-lock.json`).
- Record baseline behavior: `ng build` and `ng serve` (and `ng test` if configured).

### 2) Upgrade Path (17 -> 18 -> 19 -> 20 -> 21)
For each major step:
- Run `ng update @angular/core @angular/cli` from `frontend/`.
- Update related dev deps: `@angular-devkit/build-angular`, `@angular/compiler-cli`.
- Align runtime deps: `rxjs`, `zone.js`, and `typescript` to the versions required by that Angular major.
- Resolve any schematic migrations and CLI prompts.
- Re-run `ng build` and `ng serve` after each step.

### 3) Fix Breaking Changes
- Review Angular Update Guide for each major version and apply required code or config changes.
- Watch for deprecated APIs in templates, DI, and Router.
- If build/test tooling changes (builder names or test runners), update `frontend/angular.json` and scripts accordingly.

### 4) Verify Tooling
- Confirm `ng build` output and `dist/` artifacts are unchanged in structure.
- If `ng test` or `ng lint` is used in CI, ensure the builders are configured in `frontend/angular.json`.
- Validate production build (`ng build --configuration production`).

### 5) Cleanup and Finalize
- Remove any now-unused packages or config entries.
- Update lockfile and ensure dependency tree is clean.
- Note any follow-up refactors suggested by migrations.

## Deliverables
- Updated `frontend/package.json` + `package-lock.json` with Angular 21-compatible versions.
- Any required config updates in `frontend/angular.json` and `tsconfig*.json`.
- Notes on breaking changes applied.

## Risks / Watchouts
- Node/TypeScript version mismatches can block the upgrade; align them early.
- Builder and test runner changes may require `angular.json` updates.
- RxJS and Zone.js version constraints shift across majors.

## Acceptance Criteria
- `ng serve` and `ng build` succeed on Angular 21.
- Production build passes with no migration errors.
- No unresolved deprecation warnings at build time.
