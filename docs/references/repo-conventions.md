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

## Merging Feature Branches

- **ALWAYS** land feature branches into `main` with a squash commit (`git merge --squash <branch>`), never a merge commit.
- The squash commit message **must** follow the commit format in this doc: `<type>(<scope>): <subject>`.
- Before writing the squash commit message, summarize source-branch changes and pick message type/scope from that summary:
  - `git log --oneline main..<branch>`
  - `git diff --stat main...<branch>`
