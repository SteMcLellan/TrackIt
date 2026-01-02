# Participant Association (TrackIt)

This document describes the architecture for participant association across the Angular frontend and Azure Functions API.

## Overview
Participants are non-user entities that parents track data for. A user can be linked to multiple participants with a role that controls edit permissions.

## Data Model (Cosmos DB)
Containers and partition keys:
- `participants` (partition key: `/id`)
- `userParticipantLinks` (partition key: `/userId`)

Shapes:
```ts
export type ParticipantDocument = {
  id: string;
  displayName?: string;
  ageYears: number;
  createdAt: string;
  createdByUserId: string;
};

export type UserParticipantLinkDocument = {
  id: string; // `${userId}:${participantId}`
  userId: string;
  participantId: string;
  role: 'manager' | 'viewer';
  createdAt: string;
};
```

## API Surface
All endpoints require a valid app JWT.

### `POST /api/participants`
Creates a participant and a manager link for the current user.

Request:
```json
{ "displayName": "Avery", "ageYears": 9 }
```

Response:
```json
{
  "id": "participant_...",
  "displayName": "Avery",
  "ageYears": 9,
  "createdAt": "...",
  "createdByUserId": "user_123"
}
```

Validation:
- `ageYears` must be a positive integer.

### `GET /api/participants`
Lists participants linked to the current user. Response includes role from the link.

Response:
```json
{
  "items": [
    {
      "id": "participant_...",
      "displayName": "Avery",
      "ageYears": 9,
      "createdAt": "...",
      "createdByUserId": "user_123",
      "role": "manager"
    }
  ],
  "nextToken": null
}
```

### `GET /api/participants/{id}`
Returns participant details if the user is linked. Response includes role.

### `PATCH /api/participants/{id}`
Updates participant fields. Requires the user to have `role: manager` on the link.

Request:
```json
{ "displayName": "Avery K", "ageYears": 10 }
```

Response:
```json
{
  "id": "participant_...",
  "displayName": "Avery K",
  "ageYears": 10,
  "createdAt": "...",
  "createdByUserId": "user_123",
  "role": "manager"
}
```

Validation:
- `ageYears` must be a positive integer.
- At least one field must be provided.

## Frontend Flow
- After sign-in, the dashboard route checks `/api/participants`. If none exist, route to `/participants/start`.
- `/participants/start` provides the first-participant CTA.
- `/participants/new` creates a participant.
- `/participants` lists participants, lets the user select an active participant (stored in `localStorage`), and provides links to detail and dashboard.
- `/participants/:id` shows participant details and tracking history placeholder. Managers can edit metadata inline.

## Active Participant State
Active participant is stored in `localStorage` under `trackit.activeParticipantId` and surfaced via `ParticipantService.activeParticipantId` signal.

## Roles
Two distinct role concepts:
- User role (e.g., `parent`) is global to the account.
- Link role (`manager`/`viewer`) is scoped to a specific participant and gates edit access.

## Known Gaps / Future Work
- Delete behavior (soft vs hard).
- Age storage (years vs DOB).
- Shared participants / invites.
