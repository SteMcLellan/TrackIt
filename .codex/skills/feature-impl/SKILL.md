---
name: feature-impl
description: Create implementation plans from product feature specs and user stories. Use when the user asks how to implement a feature or wants a technical plan based on docs/feature specs. Output plans in docs/feature/<feature-name>.impl.md.
---

# Feature Implementation Planning Skill

Use this skill to turn a product spec into an implementation plan.

## Workflow
1. Locate the relevant product spec in `docs/feature/`.
2. Read `docs/feature/IMPLEMENTATION_GUIDE.md` and follow its structure.
3. Extract user stories, acceptance criteria, and scope.
4. Produce a technical implementation plan (data model, API, UI, migrations, testing).
5. Identify dependencies, risks, and sequencing.
6. Propose a step-by-step execution plan before coding.
7. Identify if changes required touch existing features and plan for updates to `docs/acrhitecture` files.

## Output Expectations
- Translate user stories into concrete technical tasks.
- Include required API/routes, data model changes, and UI components.
- Call out auth, privacy, and validation requirements.
- Provide a testing checklist aligned to acceptance criteria.
- Include a progress checklist that maps tasks back to each user story so the user can track delivery by story.

## Project-Specific Notes
- Respect repo conventions in `AGENTS.md`.
- Prefer minimal changes that align with existing architecture.
- Keep outputs under `dist/<workspace>/` only.
- Frontend work must follow modern Angular 21 practices.
