# Feature Spec: Participant Association

## Feature Summary
Parents can associate themselves with a Participant they will track data for. Participants are not app users. The system stores minimal identifiable data, with age required for context.

## Rollout / Scope
- MVP includes create, list, view, and update participant metadata.
- Multi-association is supported in the data model, but the initial UX does not include invites or sharing workflows.

## User Stories
1. As a parent, I can create a participant with minimal info so I can start tracking.
2. As a parent, I can see a list of my participants and select one.
3. As a parent, I can view a participant's details and tracking history.
4. As a parent, I can update a participant's metadata.

## User Story Details
### 1) Create a participant
**User story**  
As a parent, I can create a participant with minimal info so I can start tracking.

**Acceptance criteria**
- Age is required to create a participant.
- A participant can be created with minimal identifiable data.
- The new participant is associated to the parent who created it.
- The newly created participant appears in the parent's list.

**UX / Frontend**
- Add a "Create participant" action in the participants area (button or empty-state CTA).
- Form fields: optional display name, required age in years.
- Inline validation for missing or out-of-range age.
- Success flow returns the user to the participant list and highlights the new entry.

### 2) List and select participants
**User story**  
As a parent, I can see a list of my participants and select one.

**Acceptance criteria**
- The list only includes participants associated with the parent.
- The parent can select an active participant for tracking.
- If no participants exist, the parent is prompted to create one.

**UX / Frontend**
- Participants list view shows display name (or a fallback label) and age.
- Selecting a participant sets it as "active" and updates the tracking context.
- Empty state provides a brief explanation and a "Create participant" CTA.

### 3) View participant details
**User story**  
As a parent, I can view a participant's details and tracking history.

**Acceptance criteria**
- Only associated parents can view participant details.
- The details view includes minimal identity data and required context (age).
- Tracking history is scoped to the selected participant.

**UX / Frontend**
- Participant detail view displays display name (or fallback) and age.
- Shows recent tracking entries scoped to the active participant.
- Provides an obvious way to switch participants.

### 4) Update participant metadata
**User story**  
As a parent, I can update a participant's metadata.

**Acceptance criteria**
- Only associated parents with manager role can edit participant metadata.
- Editable fields include display name and age.
- Updates are validated and persisted, then reflected in the UI.

**UX / Frontend**
- Participant detail view includes an "Edit" action for managers.
- Edit form pre-fills current values and validates age.
- Successful update shows confirmation and refreshes the view.

## Technical Design
### Goals
- Let a parent create and view one or more participants they track.
- Allow multiple parents to associate with the same participant.
- Store minimal participant data while capturing required age context.
- Associate all tracked data to a participant and record which parent logged it.

### Non-goals
- Participants logging into the app.
- Medical diagnosis or clinician workflows.

### Terminology
- **Parent**: An authenticated user of the app.
- **Participant**: The person being tracked (not an app user).

### Data Model (Proposed)
```ts
export type ParticipantRole = 'manager' | 'viewer';

// Cosmos container: participants
// Partition key: /id (or /participantId) if globally unique; no parent-based queries here.
export type Participant = {
  id: string; // server-generated
  displayName?: string; // non-identifiable alias
  ageYears: number; // required
  createdAt: string; // ISO string
  createdBySub: string; // parent sub
};

// Cosmos container: userParticipantLinks
// Partition key: /userId for efficient "list my participants" queries.
export type UserParticipantLink = {
  userId: string; // UserDocument.id (currently equals JWT sub)
  participantId: string;
  role: ParticipantRole; // default: 'manager'
  createdAt: string; // ISO string
};
```

### API Changes (Proposed)
```ts
export type CreateParticipantRequest = {
  displayName?: string;
  ageYears: number;
};

export type CreateParticipantResponse = Participant;

export type UpdateParticipantRequest = {
  displayName?: string;
  ageYears?: number;
};

export type UpdateParticipantResponse = Participant;

export type ListParticipantsResponse = Participant[];

export type GetParticipantResponse = Participant;
```

#### POST `/api/participants`
Create a participant.
- Auth: app JWT (authenticated user required)
- Body: `CreateParticipantRequest`
- Response: `CreateParticipantResponse`

Example request:
```json
{
  "displayName": "Avery",
  "ageYears": 9
}
```

Example response:
```json
{
  "id": "participant_01HZY8X5Q6W2QK2V0G4A0B7QJ2",
  "displayName": "Avery",
  "ageYears": 9,
  "createdAt": "2025-12-31T05:12:00.000Z",
  "createdBySub": "google-oauth2|1234567890"
}
```

#### GET `/api/participants`
List participants for the authenticated parent (via userParticipantLinks).
- Auth: app JWT (authenticated user required)
- Response: `ListParticipantsResponse`

Example response:
```json
[
  {
    "id": "participant_01HZY8X5Q6W2QK2V0G4A0B7QJ2",
    "displayName": "Avery",
    "ageYears": 9,
    "createdAt": "2025-12-31T05:12:00.000Z",
    "createdBySub": "google-oauth2|1234567890"
  },
  {
    "id": "participant_01HZY8X9Y91JX1X9C6K3N7S2N1",
    "displayName": "Sam",
    "ageYears": 11,
    "createdAt": "2025-12-20T18:42:00.000Z",
    "createdBySub": "google-oauth2|1234567890"
  }
]
```

#### GET `/api/participants/{id}`
Fetch a participant by id (must be associated).
- Auth: app JWT (authenticated user required)
- Response: `GetParticipantResponse`

Example response:
```json
{
  "id": "participant_01HZY8X5Q6W2QK2V0G4A0B7QJ2",
  "displayName": "Avery",
  "ageYears": 9,
  "createdAt": "2025-12-31T05:12:00.000Z",
  "createdBySub": "google-oauth2|1234567890"
}
```

#### PATCH `/api/participants/{id}`
Update participant metadata (manager role required).
- Auth: app JWT (authenticated user required)
- Body: `UpdateParticipantRequest`
- Response: `UpdateParticipantResponse`

Example request:
```json
{
  "displayName": "Avery K",
  "ageYears": 10
}
```

Example response:
```json
{
  "id": "participant_01HZY8X5Q6W2QK2V0G4A0B7QJ2",
  "displayName": "Avery K",
  "ageYears": 10,
  "createdAt": "2025-12-31T05:12:00.000Z",
  "createdBySub": "google-oauth2|1234567890"
}
```

### Privacy & Data Minimization
- Do not store full legal names unless required.
- Avoid DOB unless explicitly needed; prefer age in years.
- Store only what is required to support tracking and context.

### Logging & Audit
- Track which parent logged each data entry (parent sub).
- All participant data is filtered by the authenticated parent's associations.

### Validation Rules
- `ageYears` must be a positive integer (e.g., 1-120).
- `displayName` is optional; enforce max length (e.g., 40 chars).

### Edge Cases
- Parent with zero participants: prompt to create one.
- Parent deletes their account: keep participants but remove associations, or transfer ownership.
- Participant deletion: should it remove tracking data or archive it?

### Open Questions
- Should we store age as `ageYears` or as DOB (and derive age)?
- Should participants be editable (e.g., age updates)?
- Do we allow soft-delete vs hard-delete for participants?
- Where should the "active participant" live in UI state?
