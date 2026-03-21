# Development Commands

This reference lists the most commonly used TrackIt development commands.

## Core Commands

```bash
npm run dev:all
npm run lint
npm run format
npm run build
npm run test:api
```

## Ralph Loop

```powershell
.\tools\ralph-loop.ps1 -Mode plan -MaxIterations 1
.\tools\ralph-loop.ps1 -Mode build -MaxIterations 3
```

## Notes

- Use `npm run dev:all` for frontend + API local development.
- Use `cat dist/frontend/dev-frontend.log` to inspect frontend compile status when dev logging is active.
- Ralph specs live in `docs/specs/`, and the loop always reads `PROMPT_plan.md` or `PROMPT_build.md` from the repo root based on `-Mode`.

See `docs/runbooks/frontend-build-verification.md` for log interpretation details.
