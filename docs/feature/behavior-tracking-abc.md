# Feature Spec: Behavior Tracking (ABC / RUBI)

## Feature Summary
Parents can log behavior incidents using the A.B.C. model (Antecedent, Behavior, Consequence) with RUBI-aligned guidance. Each incident includes time, place, and the inferred function of behavior. This helps parents capture consistent, actionable data about outbursts and incidents.

## Rollout / Scope
MVP includes:
- Create a new behavior incident with required A.B.C. fields.
- List. incidents for the active participant.
- View incident details.
- Update and delete incidents.
- Basic filters (time range, function of behavior)

RUBI guidance is present throughout the UX to help parents enter clear, consistent observations.

## User Stories
1. As a parent, I can create a behavior incident using the A.B.C. model so I can document what happened.
2. As a parent, I can see a list of incidents for my selected participant so I can review patterns.
3. As a parent, I can view an incident’s details so I can understand the full context.
4. As a parent, I can edit or delete an incident if I made a mistake.
5. As a parent, I can filter incidents by time range and function so I can focus on specific patterns.

## User Story Details
### 1) Create an incident (ABC)
**User story**  
As a parent, I can create a behavior incident using the A.B.C. model so I can document what happened.

**Important data flows and validations**
- Incident creation is scoped to the active participant.
- Required: Antecedent, Behavior, Consequence.
- Required: Time, Place, Function of Behavior.
- Time defaults to “now” but is editable.
- Function of Behavior must be selected from: Automatically Rewarding (Sensory) / Get What They Want / Avoidance / Attention Seeking.

**Acceptance criteria**
- The incident form requires A, B, and C before saving.
- The form requires time, place, and function of behavior.
- Function of behavior can only be one of the four defined options.
- On save, the incident is linked to the active participant and appears in the list.

**UX notes**
- Use short RUBI prompts near each field (e.g., “What happened right before?” for Antecedent).
- Provide helpful placeholders with non-identifying examples.
- Make the form feel quick to complete (single screen, clear labels, minimal clutter).

### 2) List incidents
**User story**  
As a parent, I can see a list of incidents for my selected participant so I can review patterns.

**Important data flows and validations**
- The list is scoped to the active participant.
- Empty state prompts the parent to add their first incident.

**Acceptance criteria**
- The list shows incidents for the active participant only.
- Each list item includes time, place, and function of behavior at a glance.
- Empty state includes a primary CTA to log an incident.

**UX notes**
- Show a concise summary line (time + place + function).
- Display A/B/C in a compact preview where space allows.
- Use the same tone as the RUBI guidance in the create flow.

### 3) View incident details
**User story**  
As a parent, I can view an incident’s details so I can understand the full context.

**Important data flows and validations**
- Only incidents for the active participant can be viewed.
- Detail view shows full A/B/C, time, place, and function.

**Acceptance criteria**
- Detail view shows all data fields.
- Includes a clear way to return to the list.

**UX notes**
- Use section headers for A/B/C to improve scanning.
- Keep layout calm and readable, with short supporting text.

### 4) Edit or delete an incident
**User story**  
As a parent, I can edit or delete an incident if I made a mistake.

**Important data flows and validations**
- Edits validate required fields and function options.
- Deletes are confirmed (to prevent accidental loss).

**Acceptance criteria**
- Parents can edit any incident fields.
- Parents can delete an incident with a confirmation step.
- Changes are reflected in list and details views.

**UX notes**
- Edit uses the same form with pre-filled values.
- Delete should be a secondary action with clear wording.

### 5) Filter incidents
**User story**  
As a parent, I can filter incidents by time range and function so I can focus on specific patterns.

**Important data flows and validations**
- Time range includes common presets (e.g., last 7 days, last 30 days) and a custom range option.
- Function filter supports the four predefined options and “All”.

**Acceptance criteria**
- Parent can filter by time range and function.
- Filters update the list immediately and are visible.

**UX notes**
- Keep filters simple and compact above the list.
- Provide a one-tap “Clear filters”.

## Open Questions
- None.

## Decisions
- **Place** will be a free-text field in MVP. Use short helper text and examples to guide consistent entry. Consider “recent places” or quick-pick chips in a later iteration.
- **Function of Behavior** is a single-select field in MVP to keep data consistent.
- **Edits/deletes** are allowed at any time, with a warning/confirmation when modifying older items.
