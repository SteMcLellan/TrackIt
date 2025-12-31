# Feature Documentation Guide

Use this folder for product-first feature specs. These docs are the source of truth before implementation.

## File Naming
- One file per feature.
- Use kebab-case names, e.g. `participant-association.md`.

## Recommended Layout
Follow the structure below (mirrors current feature docs):

1. **Feature Summary**
2. **Rollout / Scope**
3. **User Stories** (short list)
4. **User Story Details**
   - User story statement
   - Acceptance criteria
   - UX / Frontend notes
5. **Technical Design** (at the end)
   - Goals / Non-goals
   - Terminology
   - Data model (TypeScript type aliases)
     - Include Cosmos layout comments above types (container + partition key)
   - API changes
     - Type aliases for request/response
     - Endpoint list with auth requirements
     - Example request/response payloads
   - Privacy & data minimization
   - Logging & audit
   - Validation rules
   - Edge cases
   - Open questions

## Conventions
- Keep the doc product-first; defer low-level details to Technical Design.
- Use minimal identifiable data unless explicitly required.
- Make auth requirements explicit on every endpoint.
- Keep examples realistic but not tied to real user data.

## When Updating
- Update the spec before implementing changes.
- Close Open Questions as decisions are made.
- Keep acceptance criteria as the implementation checklist.
