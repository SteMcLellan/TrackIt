# Feature Spec: Medication Tracking

## Feature Summary
- Problem / why now: Parents need a reliable way to manage their child’s medication regimen and record adherence without juggling separate lists and manual notes.
- Primary users: Parents tracking medications for their children.
- Desired outcome: A clear medication list with schedules, plus a simple daily log to confirm doses taken.

## Rollout / Scope
- MVP in scope:
  - Maintain a medication list with name, dosage, frequency, start date, optional end date, and notes.
  - Log whether a medication was taken on a given day.
  - View recent adherence at a glance (per medication).
- Out of scope:
  - Refill management, pharmacy integrations, and prescribing workflows.
  - Automated reminders/notifications.
  - Medication interaction warnings.
- Phasing / rollout notes (optional):
  - Start with daily “taken/not taken” logging; ensure the workflow can evolve to support multiple doses per day later.

## User Stories
1. As a user, I want to add and manage my medication list so I know what I should be taking and when.
2. As a user, I want to log whether I took a medication today so I can track adherence.
3. As a user, I want to review recent medication adherence so I can spot missed doses.

## User Story Details
### 1) Maintain medication list
**User story**  
As a user, I want to add and manage my medication list so I know what I should be taking and when.

**Important data flows and validations**
- Required: medication name, dosage (text), frequency (e.g., daily, weekly), start date.
- Optional: end date, notes, prescribing provider (if needed later).
- Start date must be on or before end date (if set).
- Editing a medication updates future schedule expectations only (no retroactive log changes).

**Acceptance criteria**
- I can create, edit, and archive a medication.
- I can see a list of active medications with their dosage and frequency.
- I can set an optional end date and view it in the list.

**UX notes**
- Keep the list readable: name, dosage, frequency, and start/end dates in one row/card.
- Provide a quick toggle to archive inactive medications.
- Keep “Medication list” as a distinct screen/section from logging and adherence.

### 2) Log medication taken
**User story**  
As a user, I want to log whether I took a medication today so I can track adherence.

**Important data flows and validations**
- Log entries are recorded with a UTC timestamp, derived for local-day display.
- One log entry per medication per day (MVP); re-logging updates the same day’s status.
- Medications outside their start/end date should be excluded from logging prompts.
- The logging flow should be structured so multiple doses per day can be added later without rewriting the core experience.

**Acceptance criteria**
- I can mark a medication as taken or not taken for the current day.
- I can change today’s log status if I made a mistake.
- I can log for a past day within the last 30 days if needed.

**UX notes**
- Provide a daily checklist view with quick “taken/not taken” actions.
- Show three states: Taken, Not taken, Not logged.
- Keep logging in a dedicated daily checklist view, not embedded in the medication list.
- Optimize for one-tap logging: each row has immediate Taken / Not taken actions.
- Default landing view for the feature is the daily log.
- Use a card-style layout per medication with clear action buttons and an “Undo” for quick corrections.

**Sketch (low-fi)**
```
┌────────────────────────────────────────────┐
│ Med Log • Today (Jan 17)                   │
│ [<]  Child: Ava   ▼          7d | 14d | 30d│
│                                            │
│ Quick actions:  [Mark all taken]           │
├────────────────────────────────────────────┤
│ NOT LOGGED                                 │
│                                            │
│ Amoxicillin 250mg • 1x daily               │
│ Start: Jan 5                               │
│ [ Taken ]  [ Not taken ]                   │
│                                            │
│ Vitamin D 400 IU • 1x daily                │
│ Start: Jan 1                               │
│ [ Taken ]  [ Not taken ]                   │
├────────────────────────────────────────────┤
│ TAKEN                                      │
│                                            │
│ Melatonin 1mg • 1x daily                   │
│ Start: Dec 12                              │
│ [ Undo ]                                   │
├────────────────────────────────────────────┤
│ NOT TAKEN                                  │
│                                            │
│ Iron 18mg • 1x daily                       │
│ Start: Dec 20                              │
│ [ Undo ]                                   │
└────────────────────────────────────────────┘
```

### 3) Review adherence
**User story**  
As a user, I want to review recent medication adherence so I can spot missed doses.

**Important data flows and validations**
- Adherence summary uses daily logs within a selected range (e.g., 7/14/30 days).
- Archived medications are excluded by default, with an option to include them.

**Acceptance criteria**
- I can view a recent adherence summary per medication.
- I can switch between common time ranges (7/14/30 days).
- I can include archived medications in the summary when needed.

**UX notes**
- Use a compact visual indicator (e.g., streak dots) per medication.
- Keep the summary scannable on mobile.
- GitHub contribution graph–style spacing and rhythm, but in a single row per medication.
- Prefer distinct shapes for Taken / Not taken / Not logged over intensity for clarity.
- Keep adherence in a dedicated summary view, separate from the medication list and daily logging.

## Open Questions
- None.

## Decisions (optional)
- Retroactive logging window: 30 days.
- Daily log states: Taken, Not taken, Not logged.

## Addendum: Seed Medication List (for UX/demo only)
- Not medical advice. These are example seed entries to make the UI feel realistic.
- Doses are typical starting doses from public labeling and can vary by age, weight, and indication.
- For pediatric use, clinician guidance is required; keep dose as user-entered text in the product.

| Category | Medication (example) | Seed dose (typical starting) | Frequency |
| --- | --- | --- | --- |
| ADHD | Methylphenidate IR (Ritalin) | 5 mg | Twice daily |
| ADHD | Mixed amphetamine salts IR (Adderall) | 5 mg | 1 to 2 times daily |
| ADHD | Lisdexamfetamine (Vyvanse) | 30 mg | Once daily (AM) |
| ADHD | Atomoxetine (Strattera) | 0.5 mg/kg/day (<70 kg) or 40 mg/day (>=70 kg) | Once daily |
| ADHD | Guanfacine ER (Intuniv) | 1 mg | Once daily |
| Anxiety | Sertraline (Zoloft) | 25 mg | Once daily |
| Anxiety | Fluoxetine (Prozac) | 10 mg | Once daily |
| Anxiety | Escitalopram (Lexapro) | 10 mg | Once daily |
| Anxiety | Buspirone | 7.5 mg | Twice daily |
| Anxiety | Hydroxyzine | 50 to 100 mg | 4 times daily |
