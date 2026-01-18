# Feature Spec: Home (Landing Page)

## Feature Summary
- Problem / why now: The current “Dashboard” page is a welcome screen and does not help parents quickly answer “did we give meds?” or “have there been incidents recently?”, which increases friction and missed logging.
- Primary users: Parents/caregivers tracking medication adherence and behavior incidents for an active participant.
- Desired outcome: A low-friction landing page that enables one-tap logging and provides quick, glanceable insights for the last 7 days.

## Rollout / Scope
- MVP in scope:
  - Rename the “Dashboard” concept in the UI to “Home” as the post-login landing page.
  - Use `/home` as the primary route.
  - Home should only render when an active participant is selected (route users to participant setup/selection otherwise).
  - Inline “Today” medication logging (Taken / Not taken) without leaving the page.
  - A compact adherence “dots” snapshot for the last 7 days for all active medications.
  - “Incidents last 7 days” summary + recent incident previews with a fast path to log a new incident.
  - Clear empty states and next steps (no participant selected, no medications configured, no incidents yet).
- Out of scope:
  - New analytics, charts beyond the 7‑day dots snapshot, or long-range reporting.
  - Notifications, reminders, or scheduled prompts.
  - Editing full medication schedules or incidents inline (link out to full pages instead).
- Phasing / rollout notes (optional):
  - Phase 1: Home page layout + wiring to existing data + inline med logging.
  - Phase 2: Refactor reusable “dots” component and reuse on both Home and Adherence pages.

## User Stories
1. As a caregiver, I want the first page after login to feel like a “Home/Today” landing page so I immediately know what to do next.
2. As a caregiver, I want to log today’s meds inline (Taken / Not taken) so I can confirm meds were given without navigating away.
3. As a caregiver, I want a quick 7‑day adherence snapshot (“dots” diagram) so I can see missed days at a glance.
4. As a caregiver, I want a quick view of behavior incidents in the last 7 days so I can see if anything happened recently.
5. As a caregiver, when I’m missing setup (no participant selected, no meds set up), I want clear next steps so I’m not stuck.

## User Story Details
### 1) Rename “Dashboard” to “Home” and route to `/home`
**User story**  
As a caregiver, I want the first page after login to feel like a “Home/Today” landing page so I immediately know what to do next.

**Important data flows and validations**
- No new data required.
- Navigation label and page copy should reflect “Home”.
- Home requires an active participant selection:
  - If the user has zero participants, route to the participant start prompt (create-first flow).
  - If the user has participants but none selected, route to participant selection (`/participants`).

**Acceptance criteria**
- The navigation item currently labeled “Dashboard” is renamed to “Home”.
- After login, the default route lands on `/home`.
- `/dashboard` is removed (no longer a valid route).
- `/home` does not render the Home experience unless an active participant is selected; instead it routes the user to participant setup/selection.

**UX notes**
- The page should be action-oriented (quick actions above details).
- Remove or de-emphasize raw account info (email/role) from the primary experience.

### 2) Inline logging for today’s meds
**User story**  
As a caregiver, I want to log today’s meds inline (Taken / Not taken) so I can confirm meds were given without navigating away.

**Important data flows and validations**
- Uses the active participant context.
- Shows only *active* medications for “today” (local day) based on existing rules.
- Logging actions create/update the medication log entry for the selected day.
- All persisted timestamps remain UTC; any displayed local date derives from UTC/timezone info.

**Acceptance criteria**
- When an active participant is selected and active medications exist, the Home page displays a checklist of today’s meds.
- Each med row supports a one-tap action for “Taken” and “Not taken”.
- After logging, the UI reflects the updated status for that med without a full page reload.
- If a save fails, the user sees a clear error message and can retry.
- If no active meds exist, the Home page shows a clear empty state with a link to “Add medication”.

**UX notes**
- Keep this section above the fold on common laptop/mobile sizes.
- Prefer the same status pill/badge language as the Daily log for consistency.

### 3) 7‑day adherence snapshot (“dots”)
**User story**  
As a caregiver, I want a quick 7‑day adherence snapshot (“dots” diagram) so I can see missed days at a glance.

**Important data flows and validations**
- Uses the last 7 local dates (including today).
- The snapshot should be compact (no full-page filters); deeper exploration links to the full Adherence page.

**Acceptance criteria**
- The Home page shows a compact dots strip for the last 7 days per active medication.
- Dots reflect Taken / Not taken / Not logged consistently with the Adherence page.
- A link (“View adherence”) navigates to the full adherence history page.

**UX notes**
- The dots should be understandable without reading instructions (include a tiny legend or tooltip-style labels if needed).
- For space-constrained layouts, show fewer meds with an affordance like “View all”.

### 4) Incidents last 7 days
**User story**  
As a caregiver, I want a quick view of behavior incidents in the last 7 days so I can see if anything happened recently.

**Important data flows and validations**
- Uses the active participant context.
- Uses a rolling 7-day time window.

**Acceptance criteria**
- The Home page shows “Incidents (last 7 days)” with a count.
- Shows a short list of the most recent incidents (e.g., up to 3) with date/time and minimal metadata (e.g., place/function).
- Provides a prominent “Log incident” action.
- Provides a link to “View incidents” for the full list.

**UX notes**
- Keep previews scannable and short (avoid wall-of-text).
- If there are zero incidents in the range, show a reassuring empty state.

### 5) Setup-first empty states
**User story**  
As a caregiver, when I’m missing setup (no participant selected, no meds set up), I want clear next steps so I’m not stuck.

**Important data flows and validations**
- Uses existing participant selection state.

**Acceptance criteria**
- If no active participant is selected, Home shows a clear call to action to select a participant and does not show misleading empty metrics.
- If medications can’t be loaded or incidents can’t be loaded, Home shows an error state with a retry-friendly message.

**UX notes**
- Prefer “what to do next” actions over raw error text.

## Open Questions
- For the med checklist: should we allow logging for yesterday (a common “did we forget?” scenario), or keep MVP strictly “today” with a link to the Daily log for other dates?

## Decisions
- Naming: “Home” with `/home` as the primary route.
- Dots snapshot: show all active medications (7-day range).
- Incident preview: minimal (date/time + basic metadata), not full ABC text.
- Home gating: if participants exist but none selected, redirect to `/participants` (select).
