# Implementation Plan: Loggable Event Metadata (Day View Ready)

## Scope Recap
- Standardize “loggable” event metadata to support local-day (“Today / Day-by-day”) pivots consistently.
- For time-based log items, require the client to send local date/time + timezone offset so the API can compute a UTC instant.
- Support backdating (user-selected local date/time).
- Provide a secure API mechanism to migrate/backfill legacy documents so old data stays usable.

## Assumptions / Open Questions
- **Timezone offset semantics:** `logTzOffsetMinutes` is minutes east of UTC (same sign as `-new Date().getTimezoneOffset()` in browsers).
- **Time-based vs day-based:** Only time-based items require `logLocalTime` and `logTzOffsetMinutes`. Day-only items still store `logLocalDate`.
- **Compatibility window:** We will dual-read legacy fields (e.g., incidents that only have `occurredAtUtc` + `createdAt`) during rollout.
- **Migration protection:** Migration endpoints are gated by a dev-only key header + (optionally) app JWT role checks.
- Open questions to finalize before coding:
  - Should we rename all existing audit fields (`createdAt` → `createdAtUtc`) immediately, or dual-write for one release and then remove legacy?
  - Do we want “day view” queries to filter by `logLocalDate` only, or keep `fromUtc/toUtc` filters too?
  - Should the migration run as a synchronous batch (page-by-page) or an async job?

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
- `logLocalDate` is valid `YYYY-MM-DD`
- `logLocalTime` is valid `HH:mm`
- `logTzOffsetMinutes` is a finite integer within `[-840, 840]`
- A/B/C/place required, non-empty; function enum

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
- If any of `logLocalDate`/`logLocalTime`/`logTzOffsetMinutes` is updated, require the full trio (or define a strict partial update rule) and recompute `occurredAtUtc`.

### GET /api/participants/{participantId}/incidents
Auth: app JWT (linked to participant)
Response: `ListBehaviorIncidentsResponse`
Errors: 401, 403

Query options (keep compatibility while enabling day pivots):
- Existing: `fromUtc`, `toUtc`, `function`, `pageSize`, `nextToken`
- Add: `startDate`/`endDate` as `YYYY-MM-DD` for filtering on `logLocalDate`
  - If both are provided, filter by `logLocalDate` range.
  - If both `fromUtc/toUtc` and `startDate/endDate` are provided, reject (400) to avoid ambiguity.

Sorting:
- Default sort within result set: `occurredAtUtc DESC`.

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
- Require header `x-trackit-migration-key` to match env var (e.g., `MIGRATION_KEY`).
- Optionally also require `AppJwtPayload.role === 'admin'` (if/when you set that claim).

Migration behavior for legacy incidents:
- If `logLocalDate` missing: set to `occurredAtUtc.slice(0, 10)` (best-effort).
- If `logLocalTime` missing: set to `occurredAtUtc.slice(11, 16)` (best-effort).
- If `logTzOffsetMinutes` missing: leave unset (or set to `0`) and treat as “unknown offset”; do not attempt to guess.
- If `createdAtUtc` missing but legacy `createdAt` exists: copy/rename.
- Always be idempotent: only write when fields are missing or need normalization.

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
  - Parse `datetime-local`
  - Format `logLocalDate` and `logLocalTime`
  - Compute `logTzOffsetMinutes` for the selected local date/time (not just “now”)

### Validation + auth
- All loggable endpoints remain behind app JWT + participant association checks.
- For time-based log items:
  - Validate date/time formats.
  - Validate offset bounds.
  - Enforce that server computes `occurredAtUtc` from local + offset (do not accept arbitrary UTC instants).
- Migration endpoint:
  - Dev-only key header required.
  - Consider also requiring role `admin` to reduce the risk of key leakage.

### Testing approach
- Unit tests (API):
  - Local date/time validation (good/bad formats).
  - Offset validation.
  - UTC computation correctness for a few known offsets (including negative offsets).
  - Migration: idempotency (second run updates 0 items), dry-run produces no writes, scoped participant migration.
  - Migration auth gating (missing/wrong key → 403).
- Integration / manual checks:
  - Create/edit incident with backdated local date/time; verify the stored day grouping matches user input.
  - Query incidents by `startDate/endDate` and verify results match the day.
  - Run migration on a small dataset and verify legacy incidents become queryable by day.

## Sequencing
1. Finalize offset sign convention and document it (already captured in `docs/architecture/data-modeling.md`).
2. Update incident API contracts to accept local date/time + offset and compute `occurredAtUtc`.
3. Add `logLocalDate` filtering support to incident list endpoint.
4. Add the migration endpoint (secure key + optional role check) and implement behavior incidents backfill.
5. Update frontend incident create/edit to send the new request shape.
6. Run migration in dev to backfill existing incidents; verify day queries.
7. Optional cleanup: standardize remaining legacy audit fields across models (separate task if too risky).

## Story-Tracking Checklist
### Story 1: Log time-based events with local date/time
- [ ] Define shared loggable metadata envelope types.
- [ ] Update incident create/update request contracts to accept `logLocalDate`, `logLocalTime`, `logTzOffsetMinutes`.
- [ ] Implement server-side `occurredAtUtc` computation from local + offset.
- [ ] Update incident UI to send local metadata (supports backdating).

### Story 2: Support local-day grouping (“Today / Day view”)
- [ ] Add incident list filtering by `logLocalDate` (`startDate/endDate`).
- [ ] Ensure medication logs continue to support `logLocalDate` range queries.
- [ ] Define stable sorting rules for within-day ordering (prefer `occurredAtUtc DESC` for time-based).

### Story 3: Consistent data-tier metadata for loggable items
- [ ] Standardize incident document field naming (`createdAtUtc/updatedAtUtc`).
- [ ] Add validation helpers shared across time-based endpoints.
- [ ] Update architecture docs as conventions evolve (keep `docs/architecture/data-modeling.md` as source of truth).

### Story 4: Migrate existing data via a secure API
- [ ] Add migration API endpoint with dev-only key gating + optional admin role check.
- [ ] Implement behavior incidents backfill (idempotent, scoped, paged, optional dry-run).
- [ ] Add migration tests and a manual runbook (how to execute safely in dev).
- [ ] Add a helper script under `tools/` to run the migration interactively (prompts for base URL, app JWT, migration key, dry-run, scope, and loops through pages until `nextToken` is null).
