# Daily Reflection — Historical Entry Policy (Backlog Exploration)

Status: Exploring options (not scheduled)
Last updated: 2026-02-20

## Why this doc exists

`docs/backlog/daily-reflection-scoring.md` specifies one reflection per participant per `logLocalDate` and mentions a dashboard prompt for yesterday's missing entry, but does not define:

- Whether parents can create reflections for dates further in the past
- How far back historical entry should be allowed
- How the UI exposes past dates for entry or editing

Without a policy, each implementation touchpoint (API validation, calendar navigation, the "missing entry" prompt) will make local assumptions that may conflict.

---

## The core question

Families miss days. Travel, illness, hectic weeks — a parent may want to backfill 3 days of reflections on a Sunday afternoon. Should TrackIt allow this, and if so, under what constraints?

TrackIt's established logging principle (see `docs/backlog/weekly-medications.md`) is:

> Optimize for "record what actually happened." Avoid strict rules that block historical entry.

Daily reflections are subjective recall, not timestamped events — but the principle of not blocking caregivers still applies.

---

## Options

### Option A — Unlimited historical entry

Allow reflections for any past date with no window restriction.

**Pros:** Maximum flexibility; consistent with caregiver-first logging principle.
**Cons:** Reflections entered weeks or months later have low reliability. No guardrail prevents accidental mis-dated entries (e.g., tapping the wrong date on a calendar).

---

### Option B — Fixed lookback window (e.g., 30 days)

Allow historical entry up to N days in the past. Entries outside the window are read-only (if they exist) but cannot be created.

**Pros:** Covers the realistic backfill scenario (travel, illness) without enabling low-quality retrospective data. Simple to validate.
**Cons:** The right N is arbitrary; 30 days is a guess. Edge cases at the boundary feel punishing.

---

### Option C — Unlimited entry with a latency signal

Allow entry for any past date, but record how late the entry was made. Add `entryLatencyDays` (derived at save time: `createdAtUtc date − logLocalDate`) to the document or as a derived analytics field.

Analytics and insights can then weight or annotate late-entered data accordingly — e.g., exclude entries with `entryLatencyDays > 7` from trend calculations, or display a subtle indicator in the trend chart.

**Pros:** Non-blocking; preserves caregiver trust; honest about data quality in analytics.
**Cons:** Slightly more complex analytics layer; need to define what "late" means for each use case.

---

## Recommendation

**Option C** aligns best with TrackIt's logging philosophy and the 0–100 scoring model's analytics ambitions.

Concrete proposal:

1. **No hard window** on historical entry at the API or UI layer.
2. **Store `entryLatencyDays`** as a derived integer on save (not stored separately — computable from `createdAtUtc` and `logLocalDate`, but worth indexing or including in API responses for analytics consumers).
3. **Trend calculations** exclude entries with `entryLatencyDays > 7` by default, with a configurable override for future analytics tuning.
4. **Chart indicator**: entries with `entryLatencyDays > 1` show a subtle marker (e.g., open circle vs. filled dot) so parents can see which data points came from backfill vs. same-day entry.
5. **UI navigation**: the reflection entry screen exposes a date selector defaulting to today. Past dates within the last 30 days are primary navigation; older dates accessible via a full calendar picker with a visible "you're entering a past reflection" label.

---

## Interaction with existing features

### Yesterday prompt

The dashboard prompt ("You haven't reflected on yesterday yet") should remain. It is a nudge for the most common backfill case. Historical entry from the trend/calendar view covers the rest.

### Edit behavior

The same historical entry window applies to edits. Re-opening any past date within the allowed range loads existing values for editing. No separate edit window is needed.

### Trend calculations

The 7-day rolling average in `daily-reflection-scoring.md` should document whether backfilled entries (by `entryLatencyDays`) are included or excluded. The current spec is silent on this.

---

## Schema implication

`entryLatencyDays` is computable and does not need to be stored if the analytics layer can derive it. However, it should be surfaced in API responses:

```ts
interface DailyReflectionDocument {
  // ... existing fields ...
  createdAtUtc: string;        // ISO 8601 — used to derive latency
  logLocalDate: string;        // "YYYY-MM-DD" — the date being reflected on
}

// Derived in API response / analytics query:
// entryLatencyDays = daysBetween(logLocalDate, date(createdAtUtc in user's timezone))
```

Note: computing latency requires knowing the user's timezone at save time. If that is not stored today, latency can be approximated using UTC date — exact enough for the >1 day / >7 day thresholds above.

---

## Open questions

- Should `entryLatencyDays` be stored on the document or always derived? Storing it avoids timezone recomputation but adds a field.
- What is the right default exclusion threshold for trend calculations — 7 days? 3 days? Needs product input.
- Should the UI distinguish between "no entry" and "entry was deleted" for past dates? (Deletion policy is also unspecified.)
- Does the chart latency marker need to be explained with a legend, or is the visual difference (open vs. filled dot) self-explanatory enough?
