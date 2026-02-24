# Medication Frequency and Occurrence Model

## Status

Implemented in backend and frontend.
Last updated: 2026-02-24.

- `MedicationDocument` stores bounded `frequency` values (no `frequencyText`).
- Interval medications are supported via `frequency='interval-days'` with `intervalSchedule`.
- Medication log occurrence handling is strict and frequency-aware.
- As-needed logs use a dedicated server-generated endpoint.

## Product Intent

TrackIt medication logging is a caregiver record-keeping flow, not a reminder engine.

- Capture what happened.
- Keep slot/occurrence identity explicit for reliable history.
- Allow interval logging without hard schedule rejection.

## Frequency Model

`frequency` is a bounded enum:

| Value | Expected daily slots | Notes |
|---|---|---|
| `once-daily` | 1 | Uses `dose-1` |
| `twice-daily` | 2 | Uses `dose-1`, `dose-2` |
| `three-times-daily` | 3 | Uses `dose-1`, `dose-2`, `dose-3` |
| `interval-days` | 1 action row | Uses `occurrenceKey='interval'`; next due derives from anchor + interval |
| `as-needed` | variable | Uses server-generated `as-needed-*` keys |

`weekly` is modeled as interval-days with `intervalDays=7`.

## Interval Schedule Contract

When `frequency='interval-days'`, medication payload includes:

```ts
type IntervalSchedule = {
  intervalDays: number; // integer, 2..30
  anchorDateLocal: string | null; // YYYY-MM-DD
  anchorPolicy: 'reset-on-taken';
};
```

Rules:

- `intervalSchedule` is required for `interval-days`.
- `intervalSchedule` is rejected for non-interval frequencies.
- `intervalDays` must be an integer in `2..30`.
- `anchorPolicy` must be `reset-on-taken`.

## Occurrence-Key Rules

`MedicationLogDocument.occurrenceKey` semantics:

| Frequency | Allowed occurrence keys |
|---|---|
| `once-daily` | `dose-1` |
| `twice-daily` | `dose-1`, `dose-2` |
| `three-times-daily` | `dose-1`, `dose-2`, `dose-3` |
| `interval-days` | `interval` |
| `as-needed` | `as-needed-{timestamp}-{suffix}` (server generated) |

Each `(medicationId, logLocalDate, occurrenceKey)` is a distinct log row and part of the log id: `medlog_{medicationId}_{logLocalDate}_{occurrenceKey}`.

## API Enforcement (Current Behavior)

### Medication create/update

- `POST /participants/{participantId}/medications`
- `PATCH /participants/{participantId}/medications/{medicationId}`

Rules:

- `frequency` is required and must be one of the enum values above.
- `frequencyText` is rejected (`medications.frequencyText.unsupported`).
- Interval schedule validation errors:
  - `medications.intervalSchedule.required`
  - `medications.intervalSchedule.invalid`

### Medication log upsert

- `PUT /participants/{participantId}/medication-logs/{medicationId}/{logLocalDate}`

Rules:

- `occurrenceKey` is required.
- `occurrenceKey` must match frequency rules above.
- `as-needed` medications are rejected on this route (`medicationLogs.frequency.route.invalid`).
- Date/window constraints apply:
  - `logLocalDate` must be within last 30 days.
  - `logLocalDate` must be within medication start/end window.

Interval behavior on successful `status='taken'`:

- Log is written/updated at the requested date + `occurrenceKey='interval'`.
- Medication anchor resets to logged date:
  - `medication.intervalSchedule.anchorDateLocal = logLocalDate`.
- Response may include interval guidance fields:
  - `dueState: 'early' | 'due' | 'overdue'`
  - `nextDueLocalDate: string | null`

### As-needed logging

- `POST /participants/{participantId}/medication-logs/{medicationId}/{logLocalDate}/as-needed`

Rules:

- Medication must have `frequency='as-needed'`.
- Server generates `occurrenceKey` as `as-needed-{timestamp}-{suffix}`.
- Entry is always recorded as `status='taken'`.
- Same date/window constraints apply.

## Data Model References

`api/src/models/medication.ts`:

```ts
export type MedicationFrequency =
  | 'once-daily'
  | 'twice-daily'
  | 'three-times-daily'
  | 'interval-days'
  | 'as-needed';

export interface IntervalSchedule {
  intervalDays: number;
  anchorDateLocal: string | null;
  anchorPolicy: 'reset-on-taken';
}
```

`api/src/models/medication-log.ts`:

```ts
occurrenceKey: string; // scheduled: dose-1..dose-N, interval: interval, PRN: as-needed-*
```

## Timeline Projection Notes

Medication log projections include occurrence context and interval-aware copy:

- tag: `occurrence:{occurrenceKey}`
- summary field: `occurrenceKey`
- interval log subtitle includes `Every X days` context

## Migration

No schema migration is required for interval support because this change is additive.
