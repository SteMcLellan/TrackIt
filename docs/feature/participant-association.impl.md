# Implementation Plan: Participant Association

## Scope Recap
- MVP: prompt on first sign-in, create, list/select, view details, update metadata.
- Multi-association supported, but no invite/sharing UX yet.

## Assumptions / Open Questions to Resolve
- Age stored as years vs DOB (blocking for data model + validation).
- Edit guardrails for age updates.
- Delete behavior (soft vs hard).
- Where active participant is persisted (in-memory vs localStorage).

## Technical Plan
### Data Model
Use TypeScript type aliases and include Cosmos container + partition key.

```ts
export type ParticipantRole = 'manager' | 'viewer';

// Cosmos container: participants
// Partition key: /id
export type Participant = {
  id: string; // server-generated
  displayName?: string; // non-identifiable alias
  ageYears: number; // required
  createdAt: string; // ISO
  createdByUserId: string; // UserDocument.id
};

// Cosmos container: userParticipantLinks
// Partition key: /userId
export type UserParticipantLink = {
  userId: string; // UserDocument.id (currently equals JWT sub)
  participantId: string;
  role: ParticipantRole; // default: 'manager'
  createdAt: string; // ISO
};
```

Cosmos provisioning:
- Add `createIfNotExists` for database and new containers to support model evolution.

### API
Define TypeScript request/response types for reuse:

```ts
export type CreateParticipantRequest = {
  displayName?: string;
  ageYears: number;
};

export type CreateParticipantResponse = Participant;

export type ListParticipantsResponse = CollectionResponse<Participant>;

export type GetParticipantResponse = Participant;

export type UpdateParticipantRequest = {
  displayName?: string;
  ageYears?: number;
};

export type UpdateParticipantResponse = Participant;
```

API contracts (authenticated user required for all):

### POST /api/participants
Auth: app JWT
Request: CreateParticipantRequest
Response: CreateParticipantResponse
Errors: 400 (validation), 401 (unauthenticated)

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
  "createdByUserId": "user_123"
}
```

### GET /api/participants
Auth: app JWT
Request: none
Response: ListParticipantsResponse
Errors: 401 (unauthenticated)

Example response:
```json
{
  "items": [
    {
      "id": "participant_01HZY8X5Q6W2QK2V0G4A0B7QJ2",
      "displayName": "Avery",
      "ageYears": 9,
      "createdAt": "2025-12-31T05:12:00.000Z",
      "createdByUserId": "user_123"
    }
  ],
  "nextToken": null
}
```

### GET /api/participants/{id}
Auth: app JWT
Request: none
Response: GetParticipantResponse
Errors: 401 (unauthenticated), 403 (not linked), 404 (not found)

Example response:
```json
{
  "id": "participant_01HZY8X5Q6W2QK2V0G4A0B7QJ2",
  "displayName": "Avery",
  "ageYears": 9,
  "createdAt": "2025-12-31T05:12:00.000Z",
  "createdByUserId": "user_123"
}
```

### PATCH /api/participants/{id}
Auth: app JWT
Request: UpdateParticipantRequest
Response: UpdateParticipantResponse
Errors: 400 (validation), 401 (unauthenticated), 403 (not manager), 404 (not found)

Error format:
- Use RFC 9457 Problem Details (`application/problem+json`) with an `errors` array.

Example error response:
```json
{
  "type": "https://example.net/validation-error",
  "title": "Your request is not valid.",
  "status": 400,
  "errors": [
    {
      "id": "participants.age.invalid",
      "message": "Age must be a positive integer."
    }
  ]
}
```

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
  "createdByUserId": "user_123"
}
```

### Frontend
- Add Participants list view and empty state.
- Create participant form (required age, optional displayName).
- Add active participant selector and persistence strategy.
- Participant detail view + edit flow for managers.
- Post sign-in check: if zero participants, route into create flow.
- Reuse existing UI components and patterns where possible.
- Use design tokens/CSS custom properties for spacing, colors, and sizing.

### Validation & Auth
- Require auth on all participant endpoints.
- Validate age (positive integer, sensible bounds).
- Enforce manager role for edits.

### Testing
- API: auth required, role enforcement, validation errors, list filtering by user.
- Frontend: empty state prompt, create flow, selection persistence, edit visibility by role.

## Sequencing
1. Decide age storage (years vs DOB) and edit guardrails.
2. Implement Cosmos `createIfNotExists` and new containers.
3. Implement API + Cosmos access for participants and links.
4. Implement participants list + empty state + create flow.
5. Add post sign-in prompt and redirect behavior.
6. Add participant detail + edit flow.
7. Add tests and polish UX.

## Story-Tracking Checklist
- [x] Story 1: Prompt after sign-in when no participants exist.
  - [x] Check participants after auth and route to create flow.
  - [x] Show prompt whenever participant count is zero.
- [x] Story 2: Create participant with minimal info.
  - [x] Create endpoint + validation.
  - [x] Create form and success state.
  - [x] Auto-link participant to current user.
- [x] Story 3: List and select participants.
  - [x] List endpoint filtered by user links.
  - [x] List UI with empty state and selection.
  - [x] Persist active participant selection.
- [ ] Story 4: View participant details and history.
  - [ ] Detail endpoint with association check.
  - [ ] Detail UI with age/name and history placeholder.
- [ ] Story 5: Update participant metadata.
  - [ ] Update endpoint (manager role).
  - [ ] Edit UI with validation and confirmation.
- [ ] Story 6: Show dashboard when participants exist.
  - [ ] Route to dashboard on sign-in when participant count > 0.
  - [ ] Do not show create prompt when participants exist.
