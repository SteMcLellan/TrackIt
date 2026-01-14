---
name: feature-coding
description: Implement product features one user story at a time, in order, based on docs/feature/<feature-name>.impl.md. Use when the user asks to implement a feature or a specific story (e.g., "Implement user story X" or "Start coding the feature").
---

# Feature Coding Skill

Use this skill to implement features strictly story-by-story and keep the implementation plan checklist in sync.

## Workflow
1. Locate the implementation plan in `docs/feature/<feature-name>.impl.md`.
2. Identify the next unchecked user story in the Story-Tracking Checklist.
3. Implement only that story (and required minimal dependencies).
4. Update the checklist in the implementation plan as items are completed.
5. Santiy check your work against the original user story in `docs/feature/<feature-name>.md`. Identify if any acceptance criteria were missed.
5. Stop and confirm before moving to the next story.
6. If a story cannot be implemented without a later story, propose splitting or re-scoping the stories before coding.

## Rules
- Implement stories in order unless the user explicitly changes the order.
- Do not bundle multiple stories in one pass.
- Keep changes minimal and focused on the current story.
- Update the story checklist to reflect progress in `docs/feature/<feature-name>.impl.md`.
- If the last story in a feature is completed, write up the architecture notes in `docs/architecture/<feature-name>.md`. In the case where the feature updated an existing feature  update the existing architecture document.

## Output Expectations
- Summarize what was completed for the single story.
- Point to the updated checklist items.
