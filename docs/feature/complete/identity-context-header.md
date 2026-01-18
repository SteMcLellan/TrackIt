# Feature Spec: Identity + Context Header

## Feature Summary
Make it obvious who is signed in and which participant is currently active by surfacing that context in the header or a sub-header. This reduces ambiguity when viewing and logging data.

## Rollout / Scope
MVP includes:
- Display the signed-in user (name + optional avatar/email).
- Display the active participant (name + age).
- Provide a clear “switch participant” affordance that links to the participants list.
- Show a helpful empty/unknown state when no active participant is selected.

## User Stories
1. As a parent, I can always see who is signed in so I feel confident about the account context.
2. As a parent, I can always see which participant is active so I don’t log data for the wrong person.
3. As a parent, I can quickly navigate to switch participants from the context area.

## User Story Details
### 1) Signed-in user identity
**User story**  
As a parent, I can always see who is signed in so I feel confident about the account context.

**Important data flows and validations**
- Uses the authenticated user profile already stored in the app.
- If display name is missing, fall back to email or a generic label.

**Acceptance criteria**
- The UI shows the signed-in user’s name (or email fallback) in the header or sub-header.
- If a profile image exists, it is shown in a small avatar.

**UX notes**
- Keep the context subtle but visible.
- Avoid cluttering the primary navigation.

### 2) Active participant context
**User story**  
As a parent, I can always see which participant is active so I don’t log data for the wrong person.

**Important data flows and validations**
- Reads the active participant from the current app state.
- If no active participant is set, show a clear “Select participant” prompt.

**Acceptance criteria**
- The UI shows the active participant’s display name (or fallback) and age.
- When no active participant is set, the UI indicates this state clearly.

**UX notes**
- Make the active participant label visually distinct from the signed-in user label.
- Use phrasing like “Tracking: [Participant]” to reduce ambiguity.

### 3) Switch participant access
**User story**  
As a parent, I can quickly navigate to switch participants from the context area.

**Important data flows and validations**
- The link routes to the participants list.

**Acceptance criteria**
- There is a direct navigation affordance (“Switch participant”) in the context area.

**UX notes**
- Keep this action secondary; it should not be mistaken for a destructive action.

## Open Questions
- None. Decisions captured below.

## Decisions
- Place the context in a secondary sub-header row directly beneath the primary header.
- Hide the context area on authentication pages (e.g., login).
- Show the active participant context on the participants list page (still helpful for orientation).
- Fallback when no active participant: show “No active participant selected” with a “Select participant” link.
