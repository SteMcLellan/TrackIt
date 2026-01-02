---
name: feature-planning
description: Product-focused feature planning and specification writing. Use when the user asks to start a new feature or plan product changes beyond simple bug fixes. Output feature specs in docs/feature/<feature-name>.md.
---

# Feature Planning Skill

Use this skill to turn a feature idea into a product-first spec focused on users and outcomes.

## Workflow
1. Clarify the feature goal, user types, and scope.
2. Read `docs/feature/README.md` to follow the product spec structure.
3. Create or update a feature doc under `docs/feature/<feature-name>.md`.
4. Keep the doc product- and user-focused; avoid technical design details unless the feature is highly technical.
5. Confirm open questions and decisions before implementation work begins.
6. If a user story becomes dependent on a later story, split or refine stories so each one is independently deliverable.

## Required Sections
Follow the template in `docs/feature/README.md`, including:
- Feature Summary
- Rollout / Scope
- User Stories + Acceptance Criteria
- UX notes per story
- Open Questions

## Project-Specific Notes
- Avoid schemas, data models, and API design unless explicitly requested or required by the feature.
