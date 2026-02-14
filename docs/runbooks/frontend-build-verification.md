# Frontend Build Verification

Use this runbook to verify frontend compilation status when local dev logging is enabled.

## Preferred Verification Path

If `npm run dev:frontend:log` is running, read:

```bash
cat dist/frontend/dev-frontend.log
```

This is preferred over running a full build during active development.

## Success Signal

Look for:

- `Application bundle generation complete`

## Failure Signals

Look for:

- TypeScript compile errors
- Angular template/type check errors
- Module resolution errors

## When to Run a Full Build

Run `npm run build` when:

- validating production build behavior
- checking changes that may not be exercised by current dev server state
- confirming release readiness
