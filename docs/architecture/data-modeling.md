# Data Modeling (TrackIt)

This document codifies data modeling conventions for TrackIt, especially time fields and timeline projection semantics.

## Principles
- Store and process all timestamps in UTC.
- Users think in local days; day-based UX should use explicit local context fields on documents.
- Keep domain containers as source-of-truth.
- Use the `eventIndex` container as a query projection for cross-domain timeline reads.
- Favor dependency-light approaches; avoid requiring server-side timezone databases.

## Container Roles
- Domain source-of-truth containers:
  - `behaviorIncidents`
  - `medicationLogs`
  - `medications`
  - `dailyReflections`
- Timeline projection container:
  - `eventIndex`

`eventIndex` exists to support fast interleaved timeline queries (range, context window, clustering) without replacing domain records.

## Field Naming Conventions
### UTC instants
- Use `*AtUtc` for UTC instants stored as ISO 8601 strings ending with `Z`.
  - Examples: `createdAtUtc`, `updatedAtUtc`, `archivedAtUtc`, `occurredAtUtc`, `eventAtUtc`.
- Avoid mixed naming like `createdAt` in one model and `createdAtUtc` in another.

### Date-only values
- Use `*DateUtc` for UTC dates that are intentionally date-only (`YYYY-MM-DD`).
  - Examples: `startDateUtc`, `endDateUtc`.

### Local day/time values
Use these for UX day semantics and backdating.
- `logLocalDate`: `YYYY-MM-DD`
- `logLocalTime`: `HH:mm` (for time-based items)
- `logTzOffsetMinutes`: integer minutes east of UTC (same sign as `-new Date().getTimezoneOffset()` in browsers)

## Loggable Event Metadata Envelope
### Base fields
All loggable domain items should include:
- `participantId`
- `logLocalDate`
- `createdAtUtc`
- `updatedAtUtc?`

For daily reflections:
- `moodScore` (`0..100`)
- `focusScore` (`0..100`)
- `energyScore` (`0..100`)
- `sleepScore` (`0..100`)
- `journalNote?`

### Time-based additions
For items where time-of-day matters:
- `logLocalTime`
- `logTzOffsetMinutes`
- Computed UTC instant (for example `occurredAtUtc`, `takenAtUtc`)

Why both local and UTC:
- Local fields match user mental model and day grouping.
- UTC fields provide stable ordering/filtering.

## EventIndex (Timeline) Model
The EventIndex document shape is defined in `api/src/models/event-index.ts`.

### Semantics
- Append-only projection from domain writes and backfill.
- Domain documents remain authoritative.
- Each projection entry stores minimal timeline fields plus a pointer to source.

### Key fields
- `participantId`
- `eventAtUtc` (timeline axis instant)
- `logLocalDate`, `logLocalTime?`, `logTzOffsetMinutes?`
- `sourceType`: `'incident' | 'medication_log' | 'medication'`
  - includes `'daily_reflection'` when reflection projection is enabled
- `sourceId`, `sourceContainer`, `sourcePartitionKey`
- `sourceVersion` (typically latest `updatedAtUtc` or `createdAtUtc`)
- `operation`: `'upsert' | 'delete'`
- `tags: string[]`
- `summary` (small UI payload, not full domain document)
- `projectionVersion`, `projectedAtUtc`

### ID and idempotency
- Deterministic ID format:
  - `evtidx:{participantId}:{sourceType}:{sourceId}:{sourceVersion}:{operation}`
- This makes projection idempotent for reruns/backfill and supports upsert-based writes.

### Partition and indexes
- Partition key: `/participantId`
- Composite indexes:
  - `/eventAtUtc` + `/sourceType`
  - `/sourceType` + `/eventAtUtc`
  - `/logLocalDate` + `/eventAtUtc`

### Event time mapping by source
- Incident: `eventAtUtc = occurredAtUtc`
- Medication log: `eventAtUtc = takenAtUtc` when present; fallback to local date/time-derived UTC (or day-granularity if time is missing)
- Medication lifecycle projection: `updatedAtUtc` (or `archivedAtUtc` for archive transition)
- Daily reflection: `updatedAtUtc` (latest save instant for the local day entry)

## Validation Guidance
- `logLocalDate` must be valid `YYYY-MM-DD`.
- `logLocalTime` must be valid `HH:mm` (`00:00` to `23:59`).
- `logTzOffsetMinutes` must be finite and bounded (for example `[-840, 840]`).
- UTC instant fields must parse and end with `Z`.
- For medication logs with `status = not_taken`, omit `logLocalTime` and `takenAtUtc`.

## Computing UTC for Time-Based Events
For domain writes, compute UTC instants server-side from local fields:
- `logLocalDate`
- `logLocalTime`
- `logTzOffsetMinutes`

This keeps API behavior consistent across clients.

## Migration and Consistency
- Backfill endpoint:
  - `POST /api/internal/admin/migrations/event-index/backfill`
- Verify endpoint:
  - `POST /api/internal/admin/migrations/event-index/verify`
- Both endpoints require app JWT admin authorization.
- Use deterministic IDs and projection versioning for safe reruns.

## Day Semantics
- "Today" is based on the signed-in user's local date.
- Day grouping should use stored `logLocalDate` values, not ad-hoc timezone conversion from UTC at read time.

## Compatibility Guidance
When introducing field/model changes:
- Prefer dual-read during rollout.
- Add backfill where practical.
- Remove legacy paths once stable.
