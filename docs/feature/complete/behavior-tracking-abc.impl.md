# Implementation Plan: Behavior Tracking (ABC / RUBI)

## Scope Recap
- Create, list, view, edit, and delete behavior incidents using the A.B.C. model.
- Each incident includes time (UTC), place (free text), and function of behavior (single select).
- Filters by time range and function.
- RUBI guidance embedded in UX copy.

## Assumptions / Open Questions
- No new open questions. Decisions are captured in the feature spec.
- Incidents are scoped to the active participant.

## Technical Plan
### Data Model Changes
Define data models using TypeScript type aliases.

```ts
export type BehaviorFunction =
  | 'sensory'
  | 'tangible'
  | 'escape'
  | 'attention';

// Cosmos container: behaviorIncidents
// Partition key: /participantId
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

### API Shape and Endpoints
Define request/response types for reuse:

```ts
export type CreateBehaviorIncidentRequest = {
  antecedent: string;
  behavior: string;
  consequence: string;
  occurredAtUtc: string;
  place: string;
  function: BehaviorFunction;
};

export type UpdateBehaviorIncidentRequest = {
  antecedent?: string;
  behavior?: string;
  consequence?: string;
  occurredAtUtc?: string;
  place?: string;
  function?: BehaviorFunction;
};

export type BehaviorIncidentResponse = BehaviorIncidentDocument;
export type ListBehaviorIncidentsResponse = CollectionResponse<BehaviorIncidentDocument>;
```

Endpoints (all require app JWT and valid participant association):

### POST /api/participants/{participantId}/incidents
Auth: app JWT
Request: CreateBehaviorIncidentRequest
Response: BehaviorIncidentResponse
Errors: 400 (validation), 401 (unauthenticated), 403 (not linked)

Example request:
```json
{
  "antecedent": "Transition from tablet to homework",
  "behavior": "Yelling and throwing the tablet",
  "consequence": "Tablet removed and moved to a quiet space",
  "occurredAtUtc": "2026-01-04T18:12:00.000Z",
  "place": "Living room",
  "function": "escape"
}
```

### GET /api/participants/{participantId}/incidents
Auth: app JWT
Request: none
Response: ListBehaviorIncidentsResponse
Errors: 401, 403
Query params:
- `pageSize`, `nextToken` (pagination)
- `fromUtc`, `toUtc` (ISO 8601)
- `function` (single value)

### GET /api/participants/{participantId}/incidents/{incidentId}
Auth: app JWT
Request: none
Response: BehaviorIncidentResponse
Errors: 401, 403, 404

### PATCH /api/participants/{participantId}/incidents/{incidentId}
Auth: app JWT
Request: UpdateBehaviorIncidentRequest
Response: BehaviorIncidentResponse
Errors: 400, 401, 403, 404

### DELETE /api/participants/{participantId}/incidents/{incidentId}
Auth: app JWT
Request: none
Response: 204
Errors: 401, 403, 404

Validation rules:
- A/B/C: required, non-empty strings.
- Place: required, non-empty string.
- Function: must match enum.
- occurredAtUtc: required ISO UTC string; reject non-UTC inputs.

### Frontend/UI Changes
**Routes**
- `/incidents` list (scoped to active participant)
- `/incidents/new`
- `/incidents/:id`

**Components**
- `IncidentListComponent` (list + filters + empty state)
- `IncidentCreateComponent` (ABC form with RUBI prompts)
- `IncidentDetailComponent` (read-only detail + edit/delete actions)
- `IncidentEditComponent` or reuse create form for edit
- Shared `IncidentFormComponent` for create/edit

**UX Guidance**
- Add short, RUBI-aligned helper text beneath fields:
  - Antecedent: “What happened right before the behavior?”
  - Behavior: “Describe what was observed.”
  - Consequence: “What happened right after?”

**Filters**
- Function filter: single-select dropdown with the 4 options.
- Time range: presets (last 7/30 days) + custom range (UTC).

### Validation + Auth
- Require auth on all incident endpoints.
- Verify user is linked to participant (reuse participant link table).
- Only linked users can create/read/update/delete incidents.

### Testing Approach
API:
- Auth required.
- Participant association enforced (403 when not linked).
- Validation errors for missing A/B/C, place, function, or invalid UTC timestamp.
- Filters return correct scoped results.
- Update/delete on nonexistent id returns 404.

Frontend:
- Create form validation errors + success flow.
- List shows incidents for active participant only.
- Filters adjust list.
- Detail view displays all fields.
- Edit/delete flows show confirmation for older items.

## Sequencing
1. Add Cosmos container `behaviorIncidents` with partition key `/participantId`.
2. Implement API endpoints (create, list, detail, update, delete).
3. Add frontend models + services.
4. Build create form + list view + routing.
5. Add detail view with edit/delete.
6. Add filters and polish copy with RUBI guidance.
7. Tests and QA.

## Story-Tracking Checklist
- [x] Story 1: Create an incident (ABC).
  - [x] Create endpoint with validation and participant scoping.
  - [x] Create form with RUBI prompts.
  - [x] Save and show confirmation state.
- [x] Story 2: List incidents.
  - [x] List endpoint with pagination + filters.
  - [x] List UI with empty state.
- [x] Story 3: View incident details.
  - [x] Detail endpoint with auth + association check.
  - [x] Detail UI with full ABC fields.
- [x] Story 4: Edit or delete incident.
  - [x] Update + delete endpoints.
  - [x] Edit form reuse and confirmation for delete.
  - [x] Warning/confirmation for edits on older items.
- [x] Story 5: Filter incidents.
  - [x] Time range + function filters.
  - [x] Filter UI and applied state.
