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

## Partition Keys by Container
| Container | Logical Partition Field | Partition Key Path | Why |
| --- | --- | --- | --- |
| `users` | `user` | `/id` | User reads/writes are single-user lookups by subject/id. |
| `userParticipantLinks` | `user` | `/userId` | Access pattern starts from current user to list linked participants. |
| `participants` | `participant` | `/id` | Participant records are addressed directly by participant id. |
| `participantInvites` | `participant` | `/participantId` | Invite lifecycle queries are scoped to one participant. |
| `behaviorIncidents` | `participant` | `/participantId` | Incident queries are participant timeline/day scoped. |
| `medications` | `participant` | `/participantId` | Medication lists and updates are participant scoped. |
| `medicationLogs` | `participant` | `/participantId` | Log queries and upserts are participant/day scoped. |
| `dailyReflections` | `participant` | `/participantId` | Reflection queries are participant/day scoped. |
| `eventIndex` | `participant` | `/participantId` | Timeline projection reads are always participant scoped. |

## Partition Key Selection Rules
- Pick a key that matches the highest-frequency equality filter in application queries.
- Keep one tenant's working set co-located. In TrackIt, tenant scope is usually one `participantId` (or `userId` for user-centric link data).
- Optimize for read-path locality first. Cross-partition queries should be the exception, not the default.
- Choose a stable key value that does not need to change over document lifetime.
- Use a key present on every document at create time and enforce that as required model data.
- Align indexes and sort patterns to the chosen key. Composite indexes should support in-partition sorts and filters.
- For relationship/edge containers, key by the side you enumerate from most often (for example `userParticipantLinks` by `userId`).
- Re-evaluate key choice before introducing new read patterns that would force frequent cross-partition fan-out.

### Container Relationship Diagram

```
Cosmos DB Containers & Data Flow:

┌─────────────────────────────────────────────────────────────┐
│ users (partition: /id)                                      │
│ • id, createdAt, lastLoginAt, publicMetadata                │
└──────────────────────────────────────────────────────────────┘
         │
         │ manages
         ↓
┌─────────────────────────────────────────────────────────────┐
│ userParticipantLinks (partition: /userId)                   │
│ • id: {userId}:{participantId}                              │
│ • userId, participantId, role (manager|viewer), createdAt   │
└──────────────────────────────────────────────────────────────┘
         │
         │ links to
         ↓
┌─────────────────────────────────────────────────────────────┐
│ participants (partition: /id)                               │
│ • id, displayName, birthDate, ageYears, createdAt           │
└──────────────────────────────────────────────────────────────┘
         │
    ┌────┴───────┬────────────────┬─────────────────┐
    │            │                │                 │
    ↓            ↓                ↓                 ↓
┌─────────┐ ┌─────────┐ ┌──────────────┐ ┌──────────────┐
│ behavior│ │medication│ │ medication   │ │ daily        │
│Incidents│ │s         │ │ Logs         │ │Reflections   │
│(pk:     │ │(pk:      │ │(pk:          │ │(pk:          │
│partId)  │ │partId)   │ │partId)       │ │partId)       │
└─────────┘ └─────────┘ └──────────────┘ └──────────────┘
    │            │            │                │
    │            │            │                │
    └────────────┴────────────┴────────────────┘
            │
            │ [Timeline Projection]
            ↓
┌───────────────────────────────────────────────────────────┐
│ eventIndex (partition: /participantId)                    │
│ [Unified timeline of all domain events]                   │
│ • Query: /participantId + logLocalDate + eventAtUtc       │
└───────────────────────────────────────────────────────────┘
```

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
- `moodScore` (`0..100 | null`)
- `focusScore` (`0..100 | null`)
- `energyScore` (`0..100 | null`)
- `sleepScore` (`0..100 | null`)
- `journalNote?`

Score fields are `number | null`. Partial entries (any non-empty subset of dimensions) are permitted; at least one score must be provided. Null dimensions are excluded from averages and trend calculations — no interpolation for missing values in charts.

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
- Read contracts:
  - `GET /participants/{participantId}/timeline` returns projected day-window final state for UI.
  - `GET /participants/{participantId}/event-index` returns raw append-only rows for audit/debug.

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
