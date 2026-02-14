# Behavior Tracking (ABC / RUBI)

This document describes the architecture for behavior incident tracking across the Angular frontend and Azure Functions API.

## Overview
Parents can log behavior incidents using the A.B.C. model (Antecedent, Behavior, Consequence). Each incident includes time (UTC), place (free text), and a single Function of Behavior. Incidents are scoped to the active participant and require an authenticated parent.

## Data Model (Cosmos DB)
Container and partition key:
- `behaviorIncidents` (partition key: `/participantId`)

Shape:
```ts
export type BehaviorFunction = 'sensory' | 'tangible' | 'escape' | 'attention';

export type BehaviorIncidentDocument = {
  id: string;
  participantId: string;
  antecedent: string;
  behavior: string;
  consequence: string;
  occurredAtUtc: string; // ISO 8601 UTC
  place: string;
  function: BehaviorFunction;
  createdAt: string; // ISO 8601 UTC
  updatedAt?: string; // ISO 8601 UTC
  createdByUserId: string;
};
```

## API Surface
All endpoints require a valid app JWT and a valid participant association.

### `POST /api/participants/{participantId}/incidents`
Creates a new incident for the participant.

Validation:
- A/B/C required (non-empty).
- Place required (free text).
- Function must be one of the four values.
- `occurredAtUtc` must be ISO 8601 UTC.

### `GET /api/participants/{participantId}/incidents`
Lists incidents for the participant, newest to oldest.

Query params:
- `pageSize`, `nextToken`
- `fromUtc`, `toUtc` (ISO 8601 UTC)
- `function` (single value)

### `GET /api/participants/{participantId}/incidents/{incidentId}`
Returns a single incident.

### `PATCH /api/participants/{participantId}/incidents/{incidentId}`
Updates an incident. Requires at least one field.

### `DELETE /api/participants/{participantId}/incidents/{incidentId}`
Deletes an incident.

## Frontend Flow
- `/incidents/new` creates an incident for the active participant.
- `/incidents` lists incidents with filters (time range + function).
- `/incidents/:id` shows incident details and allows edit/delete.
- List “Edit” opens detail in edit mode via query param.

RUBI guidance is embedded in the incident form to prompt consistent descriptions.

## UTC Time Handling
- All stored timestamps are UTC strings.
- The UI uses local inputs but converts to UTC before save.

## Known Gaps / Future Work
- Reporting / summary insights (separate feature).
- Paging UI (API supports nextToken).
