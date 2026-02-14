# Medication Frequency: Bounded Enum Approach

## Status

Implemented in backend.

- `MedicationDocument` now stores `frequency` (bounded enum), not `frequencyText`.
- Medication log occurrence handling is strict and frequency-aware.
- As-needed logs use a dedicated server-generated endpoint.

## Use Case

As a parent tracking a child's medication, the primary concern is accountability: verifying that every scheduled dose was actually administered. If a medication is prescribed twice daily, there should be two separate check-in slots, each independently confirmable.

This is a record-keeping and review need, not a reminder or scheduling engine.

## Frequency Model

`frequency` is a bounded enum mapped to daily slot count:

| Value | Doses per day | Label |
|---|---|---|
| `once-daily` | 1 | Once daily |
| `twice-daily` | 2 | Twice daily |
| `three-times-daily` | 3 | Three times daily |
| `as-needed` | variable | As needed |

`every-other-day`, `weekly`, and `four-times-daily` are intentionally out of scope.

## Log Model and Occurrence Keys

`MedicationLogDocument.occurrenceKey` semantics:

| Frequency | Allowed occurrence keys |
|---|---|
| `once-daily` | `dose-1` |
| `twice-daily` | `dose-1`, `dose-2` |
| `three-times-daily` | `dose-1`, `dose-2`, `dose-3` |
| `as-needed` | `as-needed-{timestamp}-{suffix}` (server generated) |

Each `(medicationId, logLocalDate, occurrenceKey)` is a distinct log row and log id component.

## API Enforcement (Current Behavior)

### Medication create/update

- `POST /participants/{participantId}/medications`
- `PATCH /participants/{participantId}/medications/{medicationId}`

Rules:
- `frequency` is required and must be one of the four enum values.
- `frequencyText` is rejected with `400` (`medications.frequencyText.unsupported`).

### Scheduled medication logging

- `PUT /participants/{participantId}/medication-logs/{medicationId}/{logLocalDate}`

Rules:
- For scheduled medications, `occurrenceKey` is required.
- `occurrenceKey` must match the allowed slot keys for the medication's frequency.
- `as-needed` medications are rejected on this route (`medicationLogs.frequency.route.invalid`).
- Existing date constraints still apply:
  - log date must be within last 30 days
  - log date must be within medication start/end window

### As-needed logging

- `POST /participants/{participantId}/medication-logs/{medicationId}/{logLocalDate}/as-needed`

Rules:
- Medication must have `frequency = as-needed`.
- Server generates `occurrenceKey` as `as-needed-{timestamp}-{suffix}`.
- Entry is always recorded as `status = taken`.
- Same date/window constraints apply.

## Data Model

`api/src/models/medication.ts`:

```ts
export type MedicationFrequency =
  | 'once-daily'
  | 'twice-daily'
  | 'three-times-daily'
  | 'as-needed';

export interface MedicationDocument {
  // ...
  frequency: MedicationFrequency;
}
```

`api/src/models/medication-log.ts`:

```ts
occurrenceKey: string; // scheduled: dose-1..dose-N, PRN: as-needed-*
```

## Timeline Projection Notes

Medication log projections now include occurrence context:
- tag: `occurrence:{occurrenceKey}`
- summary field: `occurrenceKey`
- subtitle includes occurrence key for medication-log events.

## Migration

Not required for current environment. Medication and medication-log data was reset before cutover.

## Remaining Product Question

- Dose labeling in UI is still open:
  - numeric (`dose-1`, `dose-2`) vs human labels (`Morning`, `Afternoon`).
