# EventIndex Architecture Refactor

**Status:** Exploring options
**Last updated:** 2026-02-14
**Related:** `docs/architecture/data-modeling.md`

## Problem

`eventIndex` is behaving like an event log but without the discipline of proper event sourcing. When users edit or correct medication logs, new entries accumulate, making it hard to:

- Distinguish "what actually happened" from "what was corrected"
- Query "what meds were taken on date X?" without deduplication
- Keep the audit trail clean and queryable

Example: A user corrects a med entry 5 times → 5 eventIndex entries for 1 logical event.

## Current State

- `eventIndex` is the source of truth for all medication logging
- Edits, corrections, and retroactive logs all create new entries
- Timeline and Dashboard query eventIndex directly and must handle duplicates/junk
- No clear separation between "facts" (meds taken) and "corrections" (edits/amendments)

## Approaches Under Discussion

**API Layer (Server-Side Projections):**

- **`GET /api/timeline/{participantId}?date={YYYY-MM-DD}`** — returns projected data for a single day
  - Deduplicated medication entries (final state after all corrections)
  - Expected vs. actual medications for that day
  - Clean, ready-to-render for Timeline/Dashboard
  - Server computes: latest version of each med entry, correlates against Rx schedule

- **`GET /api/eventIndex/{participantId}?date={YYYY-MM-DD}`** — returns raw unprojected events
  - All events in chronological order (LogCreated, LogCorrected, LogMarkedMissed, etc.)
  - Includes metadata: who made the change, when, what changed
  - For audit trail, compliance, and debugging
  - Timeline can optionally show edit history from this

**Benefits:**
- Single source of truth (`eventIndex`)
- Clean separation: UI uses `/api/timeline` (projected), auditors use `/api/eventIndex` (raw)
- Server handles projection complexity; frontend gets clean data
- Scalable: projection can be cached per day

## Next Steps

1. **Review current `eventIndex` schema** — understand what data is stored, how edits are represented
2. **Examine Timeline and Dashboard queries** — what assumptions do they make about eventIndex?
3. **Validate Option 2 approach** — confirm `/api/timeline` (projected) and `/api/eventIndex` (raw) split makes sense for backend
4. **Plan server-side projection** — define event types, projection logic, caching strategy
5. **Plan migration** — if refactoring, how to handle existing data?
6. **Implement** — update API endpoints, backend projector, Timeline component integration

## Decision Deferred

This blocks proper Timeline implementation (handling retroactive medication logs). Will tackle before finalizing Timeline feature.
