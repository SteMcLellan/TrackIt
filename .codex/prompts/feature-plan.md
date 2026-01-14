# Feature Documentation Guide

Use this folder for product-first feature specs. These docs are the source of truth before implementation.

## File Naming
- One file per feature.
- Use kebab-case names, e.g. `participant-association.md`.
- Implementation plans should be stored as `docs/feature/<feature-name>.impl.md`.

## Recommended Layout
Follow the structure below (product- and user-focused):

1. **Feature Summary**
2. **Rollout / Scope**
3. **User Stories** (short list)
4. **User Story Details**
   - User story statement
   - Important data flows and validations
   - Acceptance criteria
   - UX notes and user-facing behavior
5. **Open Questions**

## Optional: Technical Considerations
Only add this section if the feature itself is highly technical or requires non-obvious constraints. Keep it brief and user-impact oriented (no detailed data models or API specs).

## Conventions
- Keep the doc product-first and user-focused.
- Avoid technical designs, schemas, and API details unless the feature demands it.
- Use minimal identifiable data unless explicitly required.
- Keep examples realistic but not tied to real user data.

## When Updating
- Update the spec before implementing changes.
- Close Open Questions as decisions are made.
- Keep acceptance criteria as the implementation checklist.
