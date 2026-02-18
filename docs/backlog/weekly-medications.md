# Interval-Day Medications (Backlog Exploration)

Status: Exploring options (not scheduled)
Last updated: 2026-02-18

## Product direction

TrackIt is not an enforcement app. It is a caregiver record-keeping app.

Design principle for medication logging:
- Optimize for "record what actually happened."
- Avoid strict schedule rules that block historical entry.
- Use guidance labels (`early`, `due`, `late`) instead of hard rejections.

## Why this doc exists

Current medication frequency model supports daily slots and as-needed, but not flexible interval schedules:
- `once-daily`
- `twice-daily`
- `three-times-daily`
- `as-needed`

This doc proposes a simpler replacement for weekly-specific logic: support interval-based medications as "every X days."

Weekly is just `X = 7`.

## Recommendation (single interval model)

Add one new frequency:

```ts
type MedicationFrequency =
  | 'once-daily'
  | 'twice-daily'
  | 'three-times-daily'
  | 'interval-days'
  | 'as-needed';
```

Medication schedule payload:

```ts
type IntervalSchedule = {
  intervalDays: number; // integer, >= 2 and <= 30 in v1
  anchorDateLocal: string | null; // YYYY-MM-DD, last taken/applied local date
  anchorPolicy: 'reset-on-taken';
};
```

On medication document:

```ts
intervalSchedule?: IntervalSchedule | null;
```

Rules:
- `frequency='interval-days'` requires `intervalSchedule`.
- Non-interval frequencies must not include `intervalSchedule`.
- `intervalDays=7` is the weekly case.
- Any successful `taken` log resets anchor date.

## Logging policy (important)

Never block because entry timing is "not on schedule."

Allowed for interval meds:
- on-time logging
- early logging
- late logging
- backdated corrections (within existing global date window)

System response:
- accept the entry
- recompute next due from the logged date
- show status as informational only (`early`, `due`, `overdue`)

## Cosmos changes

### `medications` container

- Add `interval-days` to `MedicationDocument.frequency`.
- Add optional `intervalSchedule`.
- Update `intervalSchedule.anchorDateLocal` on interval `taken` logs.
- No partition key or index strategy changes.

### `medicationLogs` container

- Keep existing schema.
- For interval rows, use `occurrenceKey='interval'`.
- Keep ID shape:
  - `medlog_{medicationId}_{logLocalDate}_{occurrenceKey}`

No migration required for existing records if this is additive.

## API changes

### `POST /participants/{participantId}/medications`
### `PATCH /participants/{participantId}/medications/{medicationId}`

- Support `frequency='interval-days'`.
- Validate `intervalSchedule`:
  - required for interval frequency
  - forbidden otherwise
  - `intervalDays` bounds
- New validation IDs:
  - `medications.intervalSchedule.required`
  - `medications.intervalSchedule.invalid`

### `PUT /participants/{participantId}/medication-logs/{medicationId}/{logLocalDate}`

- For interval meds, accept `occurrenceKey='interval'`.
- Do not reject for early/late schedule timing.
- On successful `status='taken'`:
  - write/overwrite log
  - set `medication.intervalSchedule.anchorDateLocal = logLocalDate`
- Suggested informational response field (optional):
  - `dueState: 'early' | 'due' | 'overdue'`

### Timeline projection

- No structural changes required.
- Continue projecting medication log events.
- Optional summary additions:
  - `intervalDays`
  - `nextDueLocalDate`

## Frontend changes

### Contract cleanup first

Align frontend contracts from `frequencyText` to `frequency` plus optional schedule objects:
- `frontend/src/app/shared/models/medication.ts`
- `frontend/src/app/shared/services/medication.service.ts`
- medication frequency helpers in profile/medications/insights

### Profile (create/edit medication)

- Add frequency option: `Every X days`.
- Show numeric input when selected:
  - label: `Repeat every`
  - input: `[ 7 ] days`
- Helper text:
  - `Marking a dose early or late resets the next due date.`

ASCII sketch:

```text
Frequency: [ Every X days v ]

Repeat every: [ 7 ] days

Help:
Applying or taking early is allowed.
Next due always becomes last taken date + interval.
```

### Medications command center (`/medications`)

For interval meds:
- Always show card/row (not only due days).
- Show:
  - `Last taken/applied`
  - `Next due`
  - due chip: `Due today`, `Due in N days`, `Overdue by N days`
- Keep swipe-first action:
  - swipe right: mark taken/applied
  - swipe left: mark not taken (if retained for consistency)
- Allow edit/update time/date to correct records.

ASCII sketch:

```text
Daytrana Patch
15mg • Every 7 days
Last applied: Thu Feb 19
Next due:     Thu Feb 26
[Due in 5 days]

Swipe right -> Applied now
Result: Next due recalculated from today
```

### Insights (`/insights`)

- Include interval meds in summary context.
- Prefer supportive language over strict compliance framing.
- Example:
  - `1 remaining • 1 due in 2 days`

### Timeline (`/timeline`)

- Keep current route/pattern.
- Medication interval entries should read clearly as historical facts.
- Example subtitle:
  - `Applied patch (every 7 days)`

## Data flow diagram

```text
[Profile form]
   | frequency=interval-days
   | intervalDays=7
   v
POST/PATCH /medications
   v
[Cosmos: medications]
   | intervalSchedule.anchorDateLocal = null initially
   v
PUT /medication-logs/{medId}/{logLocalDate}
   | occurrenceKey=interval
   | status=taken
   v
[Cosmos: medicationLogs]
   |
   +--> set medication.intervalSchedule.anchorDateLocal=logLocalDate
   v
compute nextDue = anchorDateLocal + intervalDays
   v
[/medications, /insights, /timeline]
```

## UX rule summary

- Hard blocks:
  - invalid date format
  - invalid time format
  - malformed request payload
- Soft guidance only:
  - early vs on-time vs late
  - schedule drift

This keeps caregiver data capture resilient during hectic real-world days.

## Suggested rollout

1. Backend: add `interval-days` frequency + schedule validation.
2. Backend: interval log semantics (no schedule mismatch rejection).
3. Frontend: model/service cleanup (`frequency` contracts).
4. Frontend: profile form `Every X days` input.
5. Frontend: `/medications` always-visible interval cards + due chips.
6. Frontend: insights copy update for interval context.
7. Tests: interval anchor reset, early/late acceptance, next-due math.

## Open questions

- Should `intervalDays` minimum be `2` or `1` in v1?
- Should interval meds use different action copy (`Apply`) based on medication type metadata, or always `Mark taken`?
