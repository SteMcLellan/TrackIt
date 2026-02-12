# Medication Frequency: Bounded Enum Approach

## Problem

`frequencyText` is currently a freeform string stored on `MedicationDocument`. The frontend presents a 7-option dropdown (Once daily, Twice daily, Three times daily, Four times daily, Every other day, Weekly, As needed), but the API accepts any string — there is no enforcement of valid values.

More critically, `frequencyText` is **purely cosmetic today**. It is displayed as a label on medication cards (`name · dosage · frequencyText`) but does not drive any check-in behavior. The `MedicationLogDocument` has a placeholder field `occurrenceKey` hardcoded to `"daily"` for all records, explicitly deferred with an MVP comment.

## Use Case

As a parent tracking a child's medication, the primary concern is **accountability**: verifying that every scheduled dose was actually administered. If a medication is prescribed twice daily, there should be two separate check-in slots — each independently confirmable. Reviewing the day's record should make it immediately clear whether both doses were given, one was missed, or neither occurred.

This is a record-keeping and review need, not a reminder or scheduling need. The check-in screen and the timeline are the surfaces where dose completeness will be evaluated.

## Decision: Frequency as a Bounded Enum

`frequencyText` will be replaced by a typed `frequency` field validated against a fixed set of values. The enum is intentionally narrow — it maps directly to **doses per day** for a given participant.

### Allowed Values

| Value | Doses per day | Label |
|---|---|---|
| `once-daily` | 1 | Once daily |
| `twice-daily` | 2 | Twice daily |
| `three-times-daily` | 3 | Three times daily |
| `as-needed` | variable | As needed |

### Why these four, and not the current seven

The current dropdown includes `every-other-day`, `weekly`, and `four-times-daily`. These are removed for the following reasons:

- **`every-other-day` / `weekly`** — These are scheduling concepts, not daily dose counts. They describe *when* a medication cycle occurs, not how many doses to verify on a given day. Supporting them correctly would require a scheduling layer that does not exist. They add UI complexity without serving the core accountability use case.
- **`four-times-daily`** — Removed as an edge case unlikely in the current user base (parents of children with ADHD). Can be added later if needed.
- **`as-needed`** — Kept because it describes a real category (PRN medications) with a meaningfully different check-in interaction: no automatic dose slots; instead, doses are logged ad hoc when administered.

## Impact on the Log Model

`MedicationLogDocument.occurrenceKey` was designed for this change. Currently hardcoded to `"daily"`, it will expand to represent individual dose slots generated from `frequency`:

| Frequency | occurrenceKey values per day |
|---|---|
| `once-daily` | `dose-1` |
| `twice-daily` | `dose-1`, `dose-2` |
| `three-times-daily` | `dose-1`, `dose-2`, `dose-3` |
| `as-needed` | `as-needed-{timestamp}` (ad hoc) |

Each `(medicationId, logLocalDate, occurrenceKey)` triple is a unique log entry. The check-in screen generates the expected slots from the medication's `frequency` and compares against existing logs to determine completion state.

## API Enforcement

The API must validate `frequency` against the bounded enum at both create and update. A freeform string must be rejected with a `400` and a clear error message. This prevents the frontend dropdown from being bypassed (e.g., via direct API calls or future integrations).

Validation location: `api/src/functions/medications.ts` and `medication-detail.ts`, applied before writing to Cosmos.

## Data Model Changes

**`MedicationDocument` (api/src/models/medication.ts):**
```ts
// Before
frequencyText: string;

// After
frequency: 'once-daily' | 'twice-daily' | 'three-times-daily' | 'as-needed';
```

**`Medication` (frontend/src/app/shared/models/medication.ts):** same change.

A shared `MedicationFrequency` type should be defined in the API models and mirrored on the frontend.

## Migration

Existing Cosmos documents have freeform `frequencyText` values (e.g., `"once-daily"`, `"twice-daily"` — these happen to match the new enum because the frontend dropdown was already using these values). A migration script should:

1. Read all existing `MedicationDocument` records
2. Attempt to map `frequencyText` → `frequency` using the new enum
3. For any value that doesn't map cleanly, default to `once-daily` and flag for review
4. Write the updated documents back

Existing `MedicationLogDocument` records with `occurrenceKey: "daily"` should be remapped to `occurrenceKey: "dose-1"` for consistency with the new scheme.

## Screens to Update

- **`medication-list.component.ts`** — Replace the 7-option frequency dropdown with the 4-value bounded selector
- **Medication check-in screen** — Generate N dose slots per medication from `frequency` instead of always showing one
- **Onboarding: Add Medication screen** — Use the 4-value selector from the start
- **Profile Stitch screen** — Currently shows a freeform "Time" field; update to match the bounded frequency approach

## Open Questions

- **`as-needed` check-in UX** — How does a user log an ad hoc dose? Tap-to-add on the check-in screen, or through the timeline? To be decided when building this feature.
- **Dose labeling** — Should `dose-1` / `dose-2` be labeled by time of day (e.g., "Morning dose", "Evening dose") or just numbered? Numbered is simpler; labeled is more scannable. Deferred.
