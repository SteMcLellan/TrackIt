# Implementation Plan Output Form

Use this form for `docs/feature/<feature-name>.impl.md` plans (adjust headings only if `.codex/prompts/implementation-plan.md` changes).

```
# Implementation Plan: <Feature Name>

## Scope Recap
- ...

## Assumptions / Open Questions
- ...

## Technical Plan
### Data model changes
- Types:
  - ...
- Cosmos containers + partition keys:
  - ...

### API shape and endpoints
- New / updated endpoints:
  - ...

#### API Contract Template
### METHOD /path
Auth: <auth requirement>
Request: <TypeScript type name or inline shape>
Response: <TypeScript type name or inline shape>
Errors: <status codes + brief conditions>

Example request:
{ ... }

Example response:
{ ... }

### Frontend / UI changes
- Screens / routes:
  - ...
- Components:
  - ...
- State / data flow:
  - ...

### Validation + auth
- ...

### Testing approach
- Unit tests:
  - ...
- Integration tests:
  - ...
- E2E / manual checks:
  - ...

## Sequencing
1. ...
2. ...

## Story-Tracking Checklist
### Story 1: <short story label>
- [ ] Task 1
- [ ] Task 2

### Story 2: <short story label>
- [ ] Task 1
```
