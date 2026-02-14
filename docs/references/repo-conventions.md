# Repo Conventions

This document captures naming and commit conventions for TrackIt.

## Naming

- Files: kebab-case (example: `behavior-incident.component.ts`)
- Classes and types: PascalCase (example: `BehaviorIncident`)
- Functions and variables: camelCase (example: `createIncident`)
- Constants: UPPERCASE_SNAKE_CASE (example: `API_BASE_URL`)

## TypeScript Suffixes

- Backend Cosmos documents: `*Document`
- Frontend app models: no suffix
- API request/response payloads: `*Request`, `*Response`

## Commit Format

```text
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `docs`, `refactor`, `chore`

Examples:

- `feat(incidents): add ABC behavior tracking`
- `fix(auth): resolve Google button race condition`
- `docs(architecture): update data modeling guide`
