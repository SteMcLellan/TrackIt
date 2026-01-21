# Implementation Plan: Loggable Event Metadata (Day View Ready)

## Scope Recap
- Standardize “loggable” event metadata to support local-day (“Today / Day-by-day”) pivots consistently.
- For time-based log items, require the client to send local date/time + timezone offset so the API can compute a UTC instant.
- Support backdating (user-selected local date/time).
- Provide a secure API mechanism to migrate/backfill legacy documents so old data stays usable.

## Assumptions / Decisions
- **Timezone offset semantics:** `logTzOffsetMinutes` is minutes east of UTC (same sign as `-new Date().getTimezoneOffset()` in browsers).
- **Time-based vs day-based:** Only time-based items require `logLocalTime` and `logTzOffsetMinutes`. Day-only items still store `logLocalDate`.
- **DST handling:** Trust the client's offset value. The API does not validate whether a local time actually existed or was ambiguous due to DST transitions.
- **Legacy data timezone:** All legacy incidents will be migrated with `logTzOffsetMinutes: -300` (US Eastern Time, EST). This is accurate since all existing data is recent and created in winter months.
- **Field renaming strategy:** Immediate rename of audit fields (`createdAt` → `createdAtUtc`) via migration in one release.
- **Query filtering:** Support local date ranges only (`startDate/endDate`). Remove UTC timestamp filtering (`fromUtc/toUtc`) entirely.
- **Migration execution:** Synchronous page-by-page approach. Client calls API repeatedly with continuation tokens until complete.
- **Time field updates:** All-or-nothing. To update time information, client must send all three fields: `logLocalDate`, `logLocalTime`, and `logTzOffsetMinutes` together.
- **Sorting:** Results sorted by local time within the day (`logLocalTime DESC`) when filtering by local date.
- **Date validation:** Reject future dates. Accept any other date that JavaScript Date constructor accepts.
- **Migration audit:** No special logging. Rely on Azure Function logs (App Insights) for audit trail.

## Technical Plan
### Data model changes
- Introduce a consistent loggable metadata envelope.
- Update time-based documents (starting with behavior incidents) to include local-day fields and standardized audit naming.

Types (TypeScript type aliases; naming aligned to `docs/architecture/data-modeling.md`):

```ts
export type LoggableBase = {
  participantId: string;
  logLocalDate: string; // YYYY-MM-DD
  createdAtUtc: string; // ISO 8601 UTC, ends with Z
  updatedAtUtc?: string; // ISO 8601 UTC, ends with Z
  createdByUserId: string;
};

export type TimeBasedLoggable = {
  logLocalTime: string; // HH:mm
  logTzOffsetMinutes: number; // minutes east of UTC, [-840, 840]
};

// Local -> UTC instant computation (server source of truth):
// offsetMinutes = local - UTC
// UTC = local - offsetMinutes
export type DerivedUtcInstant = {
  occurredAtUtc: string; // ISO 8601 UTC, ends with Z
};
```

Concrete models impacted in MVP:

```ts
export type BehaviorFunction = 'sensory' | 'tangible' | 'escape' | 'attention';

// Cosmos container: behaviorIncidents
// Partition key: /participantId
export type BehaviorIncidentDocument = {
  id: string;
  participantId: string;
  antecedent: string;
  behavior: string;
  consequence: string;
  place: string;
  function: BehaviorFunction;
} & LoggableBase & TimeBasedLoggable & DerivedUtcInstant;
```

Notes:
- Medication logs already have `logLocalDate`; they are “day-based” items. Keep their existing schema for now and treat any schema cleanup as a follow-up once incidents are aligned.

### Cosmos containers + partition keys
- No new containers required for MVP.
- Existing containers used:
  - `behaviorIncidents` (partition key: `/participantId`)
  - `medicationLogs` (partition key: `/participantId`)

### API shape and endpoints
Goal: for time-based log items, the server computes `occurredAtUtc` from local date/time + offset; the client should no longer send an arbitrary `occurredAtUtc` value as the source of truth.

#### Request/response types
```ts
export type CreateTimeBasedLogRequest = {
  logLocalDate: string; // YYYY-MM-DD
  logLocalTime: string; // HH:mm
  logTzOffsetMinutes: number; // minutes east of UTC
};

export type BehaviorIncidentResponse = BehaviorIncidentDocument;
export type ListBehaviorIncidentsResponse = CollectionResponse<BehaviorIncidentDocument>;
```

#### Updated endpoints (behavior incidents)
### POST /api/participants/{participantId}/incidents
Auth: app JWT (linked to participant)
Request:
```ts
export type CreateBehaviorIncidentRequest = CreateTimeBasedLogRequest & {
  antecedent: string;
  behavior: string;
  consequence: string;
  place: string;
  function: BehaviorFunction;
};
```
Response: `BehaviorIncidentResponse`
Errors: 400 (validation), 401, 403

Validation:
- `logLocalDate` is valid `YYYY-MM-DD` format and parseable by JavaScript Date
- `logLocalDate` must not be in the future (reject if after current UTC date)
- `logLocalTime` is valid `HH:mm` format
- `logTzOffsetMinutes` is a finite integer within `[-840, 840]`
- A/B/C/place required, non-empty strings; function must be valid enum value

Server behavior:
- Compute `occurredAtUtc` from local date/time + offset.
- Store `createdAtUtc` (and `updatedAtUtc` as needed).

### PATCH /api/participants/{participantId}/incidents/{incidentId}
Auth: app JWT (linked to participant)
Request:
```ts
export type UpdateBehaviorIncidentRequest = Partial<CreateTimeBasedLogRequest> & {
  antecedent?: string;
  behavior?: string;
  consequence?: string;
  place?: string;
  function?: BehaviorFunction;
};
```
Response: `BehaviorIncidentResponse`
Errors: 400, 401, 403, 404

Server behavior:
- **All-or-nothing time updates:** If any of `logLocalDate`, `logLocalTime`, or `logTzOffsetMinutes` is provided, all three must be provided together.
- Recomputes `occurredAtUtc` when time fields are updated.
- Updates `updatedAtUtc` timestamp on any modification.

### GET /api/participants/{participantId}/incidents
Auth: app JWT (linked to participant)
Response: `ListBehaviorIncidentsResponse`
Errors: 401, 403

Query parameters:
- `startDate` (optional): Start of local date range, `YYYY-MM-DD` format
- `endDate` (optional): End of local date range, `YYYY-MM-DD` format
- `function` (optional): Filter by behavior function enum
- `pageSize` (optional): Number of results per page
- `nextToken` (optional): Continuation token for pagination

Filtering:
- If `startDate` and/or `endDate` provided, filter by `logLocalDate` range.
- If neither provided, return all incidents (subject to pagination).

Sorting:
- Results sorted by local time descending: `logLocalTime DESC`
- Within-day ordering shows most recent time of day first.

#### Migration endpoints (secure API)
MVP should provide a controllable way to backfill incidents with new standardized fields.

### POST /api/admin/migrations/loggable-metadata
Auth: app JWT + migration key header (dev-only)
Request:
```ts
export type RunLoggableMetadataMigrationRequest = {
  dryRun?: boolean;
  participantId?: string; // optional scope
  maxItems?: number; // default 100, max 1000
  continuationToken?: string | null;
  include?: Array<'behaviorIncidents'>; // extensible
};
```
Response:
```ts
export type RunLoggableMetadataMigrationResponse = {
  dryRun: boolean;
  scanned: number;
  updated: number;
  skipped: number;
  errors: number;
  nextToken: string | null;
};
```
Errors: 400 (validation), 401, 403

Authorization strategy:
- Require header `x-trackit-migration-key` to match env var (e.g., `MIGRATION_KEY`)
- No special audit logging required; rely on Azure Function logs (App Insights) for audit trail

Migration behavior for legacy incidents:
- If `logLocalDate` missing: compute from `occurredAtUtc` adjusted to EST (UTC-5, -300 offset)
- If `logLocalTime` missing: compute from `occurredAtUtc` adjusted to EST
- If `logTzOffsetMinutes` missing: set to `-300` (EST, US Eastern Time)
  - **Assumption:** All existing data was created during winter months in Eastern Time zone
- If `createdAtUtc` missing but legacy `createdAt` exists: rename field to `createdAtUtc`
- If `updatedAtUtc` missing but legacy `updatedAt` exists: rename field to `updatedAtUtc`
- Always be idempotent: only write when fields are missing or need normalization
- Migration computes local date/time by: `new Date(occurredAtUtc).toLocaleString('en-US', { timeZone: 'America/New_York' })`

### Frontend / UI changes
Even if the “Day view” UI is out of scope, incidents UI must be updated to match the new contracts.

- Incident create/edit forms:
  - Capture local date and local time from the user (still a single `datetime-local` control is fine).
  - Derive:
    - `logLocalDate` (YYYY-MM-DD)
    - `logLocalTime` (HH:mm)
    - `logTzOffsetMinutes` for the selected local date/time (DST-correct)
  - Stop sending `occurredAtUtc` as an input; treat it as a server-derived output.
- Incident lists/details:
  - Continue displaying local time to user; prefer displaying based on `occurredAtUtc` until all data is migrated, then optionally use local fields for display.

Helper utilities (frontend):
- A shared date utility to:
  - Parse `datetime-local` input
  - Format `logLocalDate` (YYYY-MM-DD) and `logLocalTime` (HH:mm)
  - Compute `logTzOffsetMinutes` for the selected local date/time (handles DST correctly for backdated events)

Example implementation:
```typescript
function computeOffsetForLocalDateTime(localDate: string, localTime: string): number {
  // Construct a Date for the specific local date/time
  // This handles DST correctly for historical dates
  const localDateTime = new Date(`${localDate}T${localTime}`);
  return -localDateTime.getTimezoneOffset(); // Minutes east of UTC
}
```

**Important:** Do NOT use `new Date().getTimezoneOffset()` for backdated events - this returns today's offset, not the historical offset for the selected date.

### Validation + auth
- All loggable endpoints remain behind app JWT + participant association checks
- For time-based log items:
  - Validate date/time formats (YYYY-MM-DD, HH:mm)
  - Validate offset bounds ([-840, 840])
  - Reject future dates (logLocalDate > current date)
  - **Trust client offset:** Do not validate DST rules or whether times exist. Accept any offset value sent by client.
  - Enforce that server computes `occurredAtUtc` from local + offset (do not accept arbitrary UTC instants)
- Migration endpoint:
  - Dev-only key header required (`x-trackit-migration-key`)
  - No audit logging required (rely on Azure Function logs)

### Testing approach
- Unit tests (API):
  - Local date/time validation (good/bad formats)
  - **Future date rejection:** Verify dates after today are rejected with 400
  - **Invalid dates:** Verify Feb 30, Apr 31 are rejected (naturally fail Date parsing)
  - Offset validation (bounds check: [-840, 840])
  - UTC computation correctness for various offsets (including negative offsets like EST -300)
  - **All-or-nothing PATCH:** Verify updating only one time field without others returns 400
  - Migration: idempotency (second run updates 0 items), dry-run produces no writes, scoped participant migration
  - Migration auth gating (missing/wrong key → 403)
  - **EST offset migration:** Verify legacy incidents get -300 offset and correct local date/time
- Integration / manual checks:
  - Create/edit incident with backdated local date/time; verify stored day grouping matches user input
  - Query incidents by `startDate/endDate` and verify results match local date range
  - **Verify sorting:** Check that results within a day are sorted by `logLocalTime DESC`
  - Run migration on a small dataset and verify legacy incidents become queryable by local date
  - **Frontend offset computation:** Test backdating to summer months (EDT -240) vs winter months (EST -300) and verify correct offset is computed

## Sequencing
1. Update incident API contracts to accept local date/time + offset and compute `occurredAtUtc`
2. Remove UTC-based filtering (`fromUtc/toUtc`); implement local date filtering (`startDate/endDate`)
3. Implement sorting by `logLocalTime DESC` for query results
4. Add future date validation (reject dates after current date)
5. Implement all-or-nothing time field updates for PATCH endpoint
6. Rename audit fields immediately (`createdAt` → `createdAtUtc`, `updatedAt` → `updatedAtUtc`) in code
7. Add migration endpoint with dev-only key gating and EST offset logic (-300)
8. Update frontend incident create/edit to:
   - Send local date/time + computed offset (handles DST for backdated events)
   - Stop sending `occurredAtUtc` as input
9. Run migration in dev to backfill existing incidents with EST timezone; verify local date queries
10. Test frontend offset computation with both summer (EDT) and winter (EST) backdated dates

## Key Design Decisions & Rationale

### DST Handling: Trust Client Offset
**Decision:** API accepts any offset value without validating DST rules.
**Rationale:**
- Avoids complex server-side timezone database dependency
- Client computes offset correctly using browser's timezone data
- Ambiguous times (spring-forward/fall-back) are disambiguated by the offset value itself

### Legacy Data: Assume EST (-300)
**Decision:** Migrate all legacy data with EST offset.
**Rationale:**
- All existing data is recent (winter months)
- All users are in Eastern Time zone
- Simple, consistent migration logic

### Query Filtering: Local Date Only
**Decision:** Remove UTC timestamp filtering; support only local date ranges.
**Rationale:**
- Simpler API surface (one filtering method, not two)
- Aligns with day-by-day user mental model
- Can add UTC filtering back later if use case emerges

### Field Updates: All-or-Nothing
**Decision:** PATCH requires all three time fields together.
**Rationale:**
- Prevents inconsistent state (date updated without time)
- Simpler validation logic
- Frontend is the only client; can easily send all three

## Story-Tracking Checklist
### Story 1: Log time-based events with local date/time
- [ ] Define shared loggable metadata envelope types
- [ ] Update incident create/update request contracts to accept `logLocalDate`, `logLocalTime`, `logTzOffsetMinutes`
- [ ] Implement server-side `occurredAtUtc` computation from local + offset
- [ ] Add future date validation
- [ ] Implement all-or-nothing validation for PATCH time field updates
- [ ] Update incident UI to send local metadata (supports backdating with correct DST handling)

### Story 2: Support local-day grouping ("Today / Day view")
- [ ] Remove UTC-based filtering (`fromUtc/toUtc`)
- [ ] Add incident list filtering by local date (`startDate/endDate`)
- [ ] Implement sorting by `logLocalTime DESC` for within-day ordering
- [ ] Ensure medication logs continue to support `logLocalDate` range queries

### Story 3: Consistent data-tier metadata for loggable items
- [ ] Rename audit fields immediately (`createdAt` → `createdAtUtc`, `updatedAt` → `updatedAtUtc`)
- [ ] Add validation helpers shared across time-based endpoints
- [ ] Update architecture docs as conventions evolve (keep `docs/architecture/data-modeling.md` as source of truth)

### Story 4: Migrate existing data via a secure API
- [ ] Add migration API endpoint with dev-only key gating (`x-trackit-migration-key`)
- [ ] Implement behavior incidents backfill with EST offset (-300) logic
- [ ] Ensure migration is idempotent, scoped, paged, with optional dry-run support
- [ ] Add migration tests (idempotency, dry-run, auth gating, EST offset correctness)
- [ ] Add helper script under `tools/` to run migration interactively (synchronous page-by-page approach)
- [ ] No special audit logging required (rely on Azure Function logs)
