# Development Commands

This reference lists the most commonly used TrackIt development commands.

## Core Commands

```bash
npm run dev:all
npm run lint
npm run format
npm run build
npm run audit:stitch-migration
```

## Notes

- Use `npm run dev:all` for frontend + API local development.
- Use `npm run audit:stitch-migration` when changing Stitch-converted components or tracker entries.
- Use `cat dist/frontend/dev-frontend.log` to inspect frontend compile status when dev logging is active.

See `docs/runbooks/frontend-build-verification.md` for log interpretation details.
