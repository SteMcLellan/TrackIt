# Feature Spec: Participant Association

## Feature Summary
Parents can associate themselves with a Participant they will track data for. Participants are not app users. The system stores minimal identifiable data, with age required for context.

## Rollout / Scope
- MVP includes create, list, view, and update participant metadata.
- Multi-association is supported, but the initial UX does not include invites or sharing workflows.

## User Stories
1. As a parent, I am prompted to create a participant after sign-in if I have none.
2. As a parent, I can create a participant with minimal info so I can start tracking.
3. As a parent, I can see a list of my participants and select one.
4. As a parent, I can view a participant's details and tracking history.
5. As a parent, I can update a participant's metadata.

## User Story Details
### 1) Prompt on first sign-in
**User story**  
As a parent, I am prompted to create a participant after sign-in if I have none.

**Important data flows and validations**
- On successful sign-in, the app checks whether the parent has any associated participants.
- If none exist, the user is routed to a create participant flow.
- The prompt should not show again once a participant exists.
- This flow should lead directly into the create participant story.

**Acceptance criteria**
- Parents with zero participants are prompted to create one after sign-in.
- Parents with existing participants proceed to their normal landing experience.
- Completing the create flow removes the prompt for future sessions.

**UX notes**
- Use a friendly, action-oriented message that explains why a participant is required.
- Provide a primary CTA to create a participant immediately.
- Avoid dead ends; the user should not get stuck without a way forward.

### 2) Create a participant
**User story**  
As a parent, I can create a participant with minimal info so I can start tracking.

**Important data flows and validations**
- Age is required and must be a positive integer.
- Display name is optional and should be a short, non-identifiable alias.
- The participant is automatically associated to the parent who created it.

**Acceptance criteria**
- Age is required to create a participant.
- A participant can be created with minimal identifiable data.
- The new participant is associated to the parent who created it.
- The newly created participant appears in the parent's list.

**UX notes**
- Add a "Create participant" action in the participants area (button or empty-state CTA).
- Form fields: optional display name, required age in years.
- Inline validation for missing or out-of-range age.
- Success flow returns the user to the participant list and highlights the new entry.

### 3) List and select participants
**User story**  
As a parent, I can see a list of my participants and select one.

**Important data flows and validations**
- The list only includes participants associated with the parent.
- The selected participant becomes the active context for tracking.
- Empty state is shown when no participants exist.

**Acceptance criteria**
- The list only includes participants associated with the parent.
- The parent can select an active participant for tracking.
- If no participants exist, the parent is prompted to create one.

**UX notes**
- Participants list view shows display name (or a fallback label) and age.
- Selecting a participant sets it as "active" and updates the tracking context.
- Empty state provides a brief explanation and a "Create participant" CTA.

### 4) View participant details
**User story**  
As a parent, I can view a participant's details and tracking history.

**Important data flows and validations**
- Only associated parents can view participant details.
- Tracking history shown is scoped to the selected participant.

**Acceptance criteria**
- Only associated parents can view participant details.
- The details view includes minimal identity data and required context (age).
- Tracking history is scoped to the selected participant.

**UX notes**
- Participant detail view displays display name (or fallback) and age.
- Shows recent tracking entries scoped to the active participant.
- Provides an obvious way to switch participants.

### 5) Update participant metadata
**User story**  
As a parent, I can update a participant's metadata.

**Important data flows and validations**
- Only associated parents with manager role can edit participant metadata.
- Editable fields include display name and age.
- Updates are validated and reflected in the UI after save.

**Acceptance criteria**
- Only associated parents with manager role can edit participant metadata.
- Editable fields include display name and age.
- Updates are validated and persisted, then reflected in the UI.

**UX notes**
- Participant detail view includes an "Edit" action for managers.
- Edit form pre-fills current values and validates age.
- Successful update shows confirmation and refreshes the view.

## Open Questions
- Should we store age as age in years or use date of birth (and derive age)?
- Should participants be editable without limits (e.g., age updates), or with guardrails?
- Do we allow soft-delete vs hard-delete for participants?
- Where should the "active participant" live in UI state?
