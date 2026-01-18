# Implementation Plan: Medication Tracking

## Scope Recap
- Manage a medication list per participant (name, dosage text, frequency, start/end dates, notes, archived).
- Log daily Taken / Not taken / Not logged with a 30-day retroactive window.
- View adherence summary per medication for 7/14/30 day ranges.
- Keep list, logging, and adherence in separate UI sections; logging is the default landing view.

## Assumptions / Open Questions
- Participant context exists (from participant-association) and all medication data is scoped to `participantId`.
- Auth is already in place; only associated parents can access a participant’s meds/logs.
- For MVP, “Not logged” is derived (no log entry for that day); we only store Taken/Not taken.
- Multi-dose support will be added later; design the log model with an `occurrenceKey` to extend.
- Adherence summary can be computed client-side from logs for MVP; server-side aggregation can be added later if needed.

## Technical Plan
### Data model changes
- Types:
  - ```ts
    export type Medication = {
      id: string;
      participantId: string;
      name: string;
      dosageText: string;
      frequencyText: string;
      startDateUtc: string; // YYYY-MM-DD
      endDateUtc: string | null; // YYYY-MM-DD
      notes: string | null;
      archivedAtUtc: string | null;
      createdAtUtc: string;
      updatedAtUtc: string;
    };

    export type MedicationLog = {
      id: string;
      participantId: string;
      medicationId: string;
      logLocalDate: string; // YYYY-MM-DD (derived from user locale at log time)
      logTzOffsetMinutes: number; // offset at log time for logLocalDate derivation
      occurrenceKey: string; // "daily" for MVP; later "morning"/"evening" etc.
      status: "taken" | "not_taken";
      createdAtUtc: string;
      updatedAtUtc: string;
    };
    ```
- Cosmos containers + partition keys:
  - `medications` (partition key: `/participantId`)
  - `medicationLogs` (partition key: `/participantId`)

### API shape and endpoints
- New / updated endpoints:
  - `GET /participants/{participantId}/medications`
  - `POST /participants/{participantId}/medications`
  - `PATCH /participants/{participantId}/medications/{medicationId}`
  - `GET /participants/{participantId}/medication-logs` (date range)
  - `PUT /participants/{participantId}/medication-logs/{medicationId}/{logLocalDate}` (upsert for daily log)

#### API Contract Template
### GET /participants/{participantId}/medications
Auth: required (parent associated to participant)
Request: query params `includeArchived` (boolean, default false)
Response: CollectionResponse<Medication>
Errors: 401/403/404

Example response:
{
  "items": [ { "id": "...", "participantId": "...", "name": "Melatonin", "dosageText": "1 mg", "frequencyText": "1x daily", "startDateUtc": "2026-01-01", "endDateUtc": null, "notes": null, "archivedAtUtc": null, "createdAtUtc": "...", "updatedAtUtc": "..." } ],
  "nextToken": null
}

### POST /participants/{participantId}/medications
Auth: required
Request: {
  name: string;
  dosageText: string;
  frequencyText: string;
  startDateUtc: string; // YYYY-MM-DD
  endDateUtc?: string | null;
  notes?: string | null;
}
Response: Medication
Errors: 400/401/403/404

### PATCH /participants/{participantId}/medications/{medicationId}
Auth: required
Request: Partial<{
  name: string;
  dosageText: string;
  frequencyText: string;
  startDateUtc: string;
  endDateUtc: string | null;
  notes: string | null;
  archivedAtUtc: string | null;
}>
Response: Medication
Errors: 400/401/403/404

### GET /participants/{participantId}/medication-logs
Auth: required
Request: query params `startDate` (YYYY-MM-DD), `endDate` (YYYY-MM-DD), `medicationIds` (comma-separated, optional)
Response: CollectionResponse<MedicationLog>
Errors: 400/401/403/404

### PUT /participants/{participantId}/medication-logs/{medicationId}/{logLocalDate}
Auth: required
Request: {
  status: "taken" | "not_taken";
  logTzOffsetMinutes: number;
  occurrenceKey?: string; // default "daily"
}
Response: MedicationLog
Errors: 400/401/403/404

Example request:
{
  "status": "taken",
  "logTzOffsetMinutes": -480,
  "occurrenceKey": "daily"
}

Example response:
{
  "id": "...",
  "participantId": "...",
  "medicationId": "...",
  "logLocalDate": "2026-01-17",
  "logTzOffsetMinutes": -480,
  "occurrenceKey": "daily",
  "status": "taken",
  "createdAtUtc": "2026-01-17T18:22:11Z",
  "updatedAtUtc": "2026-01-17T18:22:11Z"
}

### Frontend / UI changes
- Screens / routes:
  - Medication List (separate from logging/adherence)
  - Daily Log (default landing view for medication feature)
  - Adherence Summary (history view)
- Components:
  - Medication card (list)
  - Daily log card with Taken / Not taken / Undo actions
  - Adherence row with 7/14/30 dot strip
  - Range switcher (7/14/30)
- State / data flow:
  - Use signals for local state and derived views.
  - Fetch with `httpResource` (or equivalent resource) scoped to `participantId`.
  - Derive "Not logged" by comparing medications to log entries for the day.
  - Cache log responses per date range; invalidate on log updates.

### Validation + auth
- Validate required fields: name, dosageText, frequencyText, startDateUtc.
- Validate date order: startDateUtc <= endDateUtc (if provided).
- Enforce 30-day retroactive logging window on server (400 if outside).
- Require parent association to participant for all endpoints.
- Only active medications (by date range and not archived) appear in daily log list.

### Testing approach
- Unit tests:
  - API validation (date order, required fields, 30-day window)
  - Log upsert behavior (same day updates)
  - Adherence summary calculation (client)
- Integration tests:
  - CRUD meds for a participant
  - Daily log upsert and retrieval across date ranges
- E2E / manual checks:
  - Create meds, log today, edit status, verify UI states
  - Switch participant context
  - Adherence range switching (7/14/30)

## Sequencing
1. Add data types and Cosmos containers for medications and medicationLogs.
2. Implement API endpoints and validation for meds and logs.
3. Build Medication List UI (create/edit/archive).
4. Build Daily Log UI (default landing view) with one-tap actions.
5. Build Adherence Summary UI with 7/14/30 ranges.
6. Wire end-to-end data flow and validate derived states.
7. Add tests (API + frontend) aligned to acceptance criteria.

## Story-Tracking Checklist
### Story 1: Maintain medication list
- [x] Add `Medication` type + `medications` container.
- [x] Implement list/create/update/archive endpoints.
- [x] Build Medication List screen and card UI.
- [x] Add validation and error handling.

### Story 2: Log medication taken
- [x] Add `MedicationLog` type + `medicationLogs` container.
- [x] Implement daily log upsert endpoint and range fetch.
- [x] Build Daily Log screen with Taken / Not taken / Undo.
- [x] Derive Not logged state client-side.
- [x] Enforce 30-day retroactive rule.

### Story 3: Review adherence
- [x] Build adherence summary view with dot strips.
- [x] Add 7/14/30 range switcher.
- [x] Filter archived meds by default with optional include toggle.
