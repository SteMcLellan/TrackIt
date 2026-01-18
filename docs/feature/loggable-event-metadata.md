# Feature Spec: Loggable Event Metadata (Day View Ready)

## Feature Summary
- Problem / why now: A “Today” / “Day-by-day” view should show everything that happened on a given day for a participant. Right now, different event types represent time differently (UTC instants vs local day keys), making it harder to query and present a unified day timeline consistently.
- Primary users: Parents/caregivers who review daily activity and want a quick “what happened today?” summary.
- Desired outcome: All “loggable” events use a consistent set of metadata fields so the API can support day-based views (local day) without complex, inconsistent client logic.

## Rollout / Scope
- MVP in scope:
  - Standardize core “loggable” metadata fields and naming conventions across time-based items.
  - Update API contracts so time-based log items provide the local-day context and timezone offset needed for the server to compute UTC instants.
  - Ensure backdating is supported (user-selected local day and time).
- Out of scope:
  - Implementing the full “Day view” UI (can be a follow-up feature once data contracts are consistent).
  - Migrating historical data beyond a minimal compatibility/backfill strategy (decision; can be iterative).
  - Adding dependencies for timezone databases on the server.
- Phasing / rollout notes (optional):
  - Phase 1: Introduce new fields + dual-read/compat behavior.
  - Phase 2: Migrate existing data + remove legacy fields.

## User Stories
1. As a parent, I can log time-based events (like incidents) with a local date and time (including backdating) so my records match how I remember the day.
2. As a parent, I can view a “Today” / “Day” summary that groups items by my local day so I can see everything that happened on that day.
3. As a developer, I can treat all loggable items consistently in the data tier so day-based queries and UI pivots are straightforward.
4. As a developer, I can migrate existing data via a secure API so legacy records remain usable without manual database work.

## User Story Details
### 1) Log time-based events with local date/time
**User story**  
As a parent, I can log time-based events (like incidents) with a local date and time (including backdating) so my records match how I remember the day.

**Important data flows and validations**
- The user chooses the local date and local time for the event.
- The API requires the client’s locale offset (minutes) for the chosen local date/time so the server can compute a UTC instant consistently.
- Backdating must be supported (e.g., logging an incident that happened yesterday).

**Acceptance criteria**
- For time-based log items, the API contract includes:
  - `logLocalDate` (YYYY-MM-DD)
  - `logLocalTime` (HH:mm)
  - `logTzOffsetMinutes` (integer minutes offset used to compute UTC)
- The API rejects invalid formats (bad date, bad time, unrealistic offset).
- The API computes and stores an unambiguous UTC instant for time-based items (field name decision; e.g., `occurredAtUtc`).

**UX notes**
- UI shows local date + local time entry. The displayed day grouping matches what the user entered.

### 2) Support local-day grouping (“Today / Day view”)
**User story**  
As a parent, I can view a “Today” / “Day” summary that groups items by my local day so I can see everything that happened on that day.

**Important data flows and validations**
- “Today” is based on the signed-in user’s local day.
- Items are grouped by the stored `logLocalDate` field for consistency across event types.

**Acceptance criteria**
- The data tier supports listing items for a participant by `logLocalDate` without needing cross-container full scans.
- Sorting within a day is stable:
  - Time-based items sort by their time-of-day (or derived UTC instant).
  - Non-time-based items have a deterministic fallback order (e.g., by creation time).

**UX notes**
- Day view can be introduced later; this feature ensures the data is ready for it.

### 3) Consistent data-tier metadata for loggable items
**User story**  
As a developer, I can treat all loggable items consistently in the data tier so day-based queries and UI pivots are straightforward.

**Important data flows and validations**
- All loggable items share a small base metadata envelope (naming and semantics).

**Acceptance criteria**
- A common set of fields exists (or is planned) for all loggable event documents:
  - `participantId`
  - `logLocalDate`
  - `createdAtUtc` / `updatedAtUtc?`
  - `createdByUserId`
- Time-based items additionally include:
  - `logLocalTime`
  - `logTzOffsetMinutes` (for computing UTC)
  - a computed UTC instant (e.g., `occurredAtUtc`)
- Field naming uses `*AtUtc` suffix for UTC instants and avoids mixed naming like `createdAt` vs `createdAtUtc`.

**UX notes**
- Not applicable (developer-facing consistency).

### 4) Migrate existing data via an API
**User story**  
As a developer, I can migrate existing data via a secure API so legacy records remain usable without manual database work.

**Important data flows and validations**
- Migration runs are authenticated/authorized and not exposed as a normal end-user feature.
- Migrations are idempotent (safe to run multiple times).
- A migration can be scoped (e.g., by participant, by date range, by document type) to reduce risk.
- The API provides clear outcomes (what changed, what failed, what was skipped).

**Acceptance criteria**
- There is an API mechanism to run a migration that backfills new standardized fields on legacy documents.
- The migration can be executed without direct Cosmos DB access (no manual scripts required).
- The migration has a “dry run” or “preview” mode (decision) to report what would change.
- The migration returns a summary suitable for logs (counts updated/skipped/errors).

**UX notes**
- Not user-facing; consider an “admin/dev tools” screen only if needed later.

## Open Questions
- Should `logTzOffsetMinutes` be required for all loggable items, or only time-based items?
- For backdated entries, should the offset be computed for the selected local date/time (DST-correct), or is “current offset” acceptable?
- For time-based items, do we store both:
  - `logLocalDate` + `logLocalTime` + `logTzOffsetMinutes`
  - and the derived `occurredAtUtc`
  Or do we store only local + compute UTC on reads?
- Do we allow editing local date/time after creation, and if so do we recompute `occurredAtUtc`?
- What is the rollout strategy for existing documents with legacy timestamp fields?
- How is the migration API protected (dev-only key, admin role, environment gate)?
- Do we need progress tracking for large migrations (job-style), or are synchronous batches acceptable?

## Decisions (optional)
- None yet.

## Technical Considerations (optional)
- Avoid adding timezone database dependencies on the server.
- The client can compute `logTzOffsetMinutes` for the selected local date/time using platform timezone rules.
- Store/process timestamps in UTC for audit and cross-day computations; derive any local display from stored values.
