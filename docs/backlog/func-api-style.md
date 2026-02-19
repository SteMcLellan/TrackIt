# Function API Style Standardization

Status: Draft backlog item
Last updated: 2026-02-18

## Problem

- HTTP handlers are not fully standardized around one composition pattern.
- Some routes use wrapper helpers (`withParticipantContext`, `withAuthContext`, `withErrorHandling`), others follow older composition patterns.
- File structure across `api/src/functions` is inconsistent and makes onboarding/refactoring slower.

## Goal

Define and apply one consistent API handler model across every registered endpoint.

## Candidate style direction

Borrow middleware composition patterns similar to `@senacor/azure-function-middleware`, while preserving TrackIt conventions from `docs/architecture/api-conventions.md` (error shape, auth wrappers, participant context, validation IDs).

Example inspiration:

```ts
const httpHandler = async (request: HttpRequest, context: InvocationContext) => {
  context.info('function called');
  return { status: 201 };
};

const requestBodySchema = Joi.object().keys({
  name: Joi.string().min(3).max(30).required(),
});

app.http('example-function', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'example',
  handler: middleware(
    [requestBodyValidation(requestBodySchema)],
    httpHandler,
    []
  ),
});
```

## API inventory checklist

Use this as the master list for standardization work.

### Auth

- [ ] `POST /auth/login` (`auth-login`)
- [ ] `POST /auth/refresh` (`auth-refresh`)

### User-scoped

- [ ] `GET /me` (`me`)
- [ ] `GET /participants` (`participants-list`)
- [ ] `POST /participants` (`participants-create`)

### Participant detail and membership

- [ ] `GET /participants/{id}` (`participant-detail-get`) (compatibility route param)
- [ ] `PATCH /participants/{id}` (`participant-detail-patch`) (compatibility route param)
- [ ] `GET /participants/{participantId}/members` (`participant-members-list`)
- [ ] `DELETE /participants/{participantId}/members/{userId}` (`participant-members-revoke`)
- [ ] `GET /participants/{participantId}/invites/active` (`participant-invites-active-get`)
- [ ] `POST /participants/{participantId}/invites` (`participant-invites-create`)
- [ ] `POST /participants/{participantId}/invites/{inviteId}/accept` (`participant-invites-accept`)

### Behavior incidents

- [ ] `GET /participants/{participantId}/incidents` (`behavior-incidents-list`)
- [ ] `POST /participants/{participantId}/incidents` (`behavior-incidents-create`)
- [ ] `GET /participants/{participantId}/incidents/{incidentId}` (`behavior-incident-detail-get`)
- [ ] `PATCH /participants/{participantId}/incidents/{incidentId}` (`behavior-incident-detail-patch`)
- [ ] `DELETE /participants/{participantId}/incidents/{incidentId}` (`behavior-incident-detail-delete`)

### Medications

- [ ] `GET /participants/{participantId}/medications` (`medications-list`)
- [ ] `POST /participants/{participantId}/medications` (`medications-create`)
- [ ] `GET /participants/{participantId}/medications/{medicationId}` (`medication-detail-get`)
- [ ] `PATCH /participants/{participantId}/medications/{medicationId}` (`medication-detail-patch`)

### Medication logs

- [ ] `GET /participants/{participantId}/medication-logs` (`medication-logs-list`)
- [ ] `PUT /participants/{participantId}/medication-logs/{medicationId}/{logLocalDate}` (`medication-logs-upsert`)
- [ ] `POST /participants/{participantId}/medication-logs/{medicationId}/{logLocalDate}/as-needed` (`medication-logs-as-needed-create`)
- [ ] `GET /participants/{participantId}/medication-logs/{logId}` (`medication-log-detail-get`)
- [ ] `DELETE /participants/{participantId}/medication-logs/{logId}` (`medication-log-detail-delete`)

### Daily reflections

- [ ] `GET /participants/{participantId}/daily-reflections` (`daily-reflections-list`)
- [ ] `PUT /participants/{participantId}/daily-reflections/{logLocalDate}` (`daily-reflections-upsert`)
- [ ] `GET /participants/{participantId}/daily-reflections/summary` (`daily-reflections-summary`)

### Timeline and event index

- [ ] `GET /participants/{participantId}/timeline` (`timeline-list`)
- [ ] `GET /participants/{participantId}/timeline/context/{sourceType}/{sourceId}` (`timeline-context`)
- [ ] `GET /participants/{participantId}/event-index` (`event-index-list`)

### Internal admin

- [ ] `POST /internal/admin/migrations/event-index/backfill` (`admin-timeline-backfill`)
- [ ] `POST /internal/admin/migrations/event-index/verify` (`admin-timeline-verify`)

## Open decisions

- Should we keep current wrappers as the public API and build middleware under them, or replace wrappers directly with middleware composition?
- Do we want one folder convention per endpoint (for example `api/src/functions/<resource>/<action>.ts`) or keep flat files with stricter naming?
