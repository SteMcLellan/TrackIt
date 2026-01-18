# Data Modeling (TrackIt)

This document codifies the data modeling conventions for TrackIt, especially around time/date fields and “loggable” events so future features (like “Today / Day-by-day”) remain straightforward.

## Principles
- Store and process all timestamps in UTC.
- Users think in local days; day-based UX should be powered by an explicit local-day field on stored documents (not inferred ad-hoc from UTC instants).
- Keep data models consistent across features; prefer a small shared metadata envelope for “loggable” items.
- Favor dependency-light approaches; avoid requiring server-side timezone databases.

## Field Naming Conventions
### UTC instants
- Use `*AtUtc` for UTC instants stored as ISO 8601 strings ending with `Z`.
  - Examples: `createdAtUtc`, `updatedAtUtc`, `archivedAtUtc`, `occurredAtUtc`.
- Avoid mixed naming like `createdAt` in one model and `createdAtUtc` in another.

### Date-only values
- Use `*DateUtc` for UTC dates that are intentionally date-only (`YYYY-MM-DD`).
  - Examples: `startDateUtc`, `endDateUtc`.

### Local day/time values (user context)
Use these for UX-driven “day” semantics and backdating.
- `logLocalDate`: `YYYY-MM-DD` (the user’s chosen local day bucket for the event)
- `logLocalTime`: `HH:mm` (the user’s chosen local clock time; only for time-based items)
- `logTzOffsetMinutes`: integer minutes offset used to derive UTC from local date/time (only for time-based items)
  - Convention: minutes east of UTC (same sign as `-new Date().getTimezoneOffset()` in browsers).

## Loggable Event Metadata Envelope
### Base fields (all loggable items)
Every “loggable” item should include:
- `participantId`
- `logLocalDate`
- `createdAtUtc`
- `updatedAtUtc?`
- `createdByUserId`

### Time-based additions (incidents and similar)
For events where time-of-day matters, also include:
- `logLocalTime`
- `logTzOffsetMinutes`
- A computed UTC instant for the event (e.g., `occurredAtUtc`)

Why store both local and UTC?
- Local fields power day grouping and match how users recall events (including backdating).
- UTC instants support stable ordering, filtering, and cross-feature computations without ambiguity.

## Validations (Recommended)
- `logLocalDate` must be `YYYY-MM-DD` and represent a real calendar date.
- `logLocalTime` must be `HH:mm` (00:00–23:59).
- `logTzOffsetMinutes` must be a finite integer within a sane bound (e.g., `[-840, 840]`).
- `*AtUtc` values must be parseable ISO 8601 UTC instants (must end with `Z`).

## Computing UTC for Time-Based Events (Server-Side)
When a time-based event is created/updated, the API should compute the event UTC instant from:
- `logLocalDate`
- `logLocalTime`
- `logTzOffsetMinutes`

This keeps the server as the source of truth and avoids drift if clients format timestamps differently.

## Day Semantics
- “Today” is defined by the signed-in user’s local date.
- Users may travel; it’s acceptable for “today” to follow their current locale. Day grouping should still use the stored `logLocalDate` for each event (what the user chose when logging).

## Compatibility / Migration Guidance
- When introducing new standardized fields, prefer:
  - dual-read (support old + new during rollout),
  - backfill for existing documents where practical,
  - then remove legacy fields once stable.
