# Implementation Plan: Home (Landing Page)

## Scope Recap
- Replace the current “Dashboard” landing experience with a “Home” landing page at `/home`.
- Remove `/dashboard` (no alias/redirect).
- Gate Home behind an active participant selection:
  - 0 participants → `/participants/start`
  - participants exist but none selected → `/participants`
- Inline medication logging for today (Taken / Not taken) on Home.
- Show a 7‑day adherence “dots” snapshot for all active medications.
- Show a minimal “Incidents (last 7 days)” summary with a short recent list and quick actions.

## Assumptions / Open Questions
- Open question retained: whether Home should support “Yesterday” med logging (explicitly out of scope for MVP).
- No API changes are required for MVP; existing meds/logs/incidents endpoints are sufficient.
- “Active medications” on Home means: not archived and active for today’s local date (`startDateUtc <= today` and `endDateUtc` null or `>= today`).

## Technical Plan
### Data model changes
- None.

### API shape and endpoints
- No new endpoints for MVP. Reuse existing:
  - `GET /participants/{participantId}/medications` (active meds derived client-side)
  - `GET /participants/{participantId}/medication-logs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
  - `PUT /participants/{participantId}/medication-logs/{medicationId}/{logLocalDate}` (upsert)
  - `GET /participants/{participantId}/incidents?fromUtc=<isoZ>&toUtc=<isoZ>&pageSize=100`

Notes:
- Incidents “count” will be `items.length` for the requested range (fetch `pageSize=100` for MVP). If users can exceed 100 incidents in 7 days, consider adding `totalCount` later.

### Frontend / UI changes
#### Screens / routes
- Add `/home` route (new Home component) and set default redirect (`/`) to `/home`.
- Update nav label and links from “Dashboard” to “Home”.
- Update post-login navigation to route to `/home`.

#### Guards
- Add a new guard for Home (e.g., `ActiveParticipantGuard`):
  - If `ParticipantService.activeParticipantId()` is set → allow.
  - Else call `ParticipantService.listParticipants(1)`:
    - no participants → redirect to `/participants/start`
    - otherwise → redirect to `/participants`
  - Apply to `/home` route along with `AuthGuard`.
- Retire `ParticipantStartGuard` from the landing route (optional). If kept, ensure it does not conflict/double-redirect.

#### Home page layout (MVP)
Use the existing `CardComponent` patterns and keep the page action-first.

- **Card: Quick actions**
  - Primary CTA: “Log incident” (`/incidents/new`)
  - Secondary: “View incidents” (`/incidents`), “Medication list” (`/medications/list`), “Adherence” (`/medications/history`)

- **Card: Today’s meds (inline logging)**
  - Show a checklist of active medications for today’s local date.
  - Each row shows medication name + dosage/frequency + current status badge.
  - Actions: “Taken” and “Not taken” buttons that call `MedicationLogService.upsertLog(...)`.
  - Optimistic UI is optional; at minimum refresh logs on success and show a lightweight error message on failure.

- **Card: 7‑day adherence snapshot (dots)**
  - Extract the dots strip rendering from `MedicationAdherenceComponent` into a reusable presentational component:
    - Example: `frontend/src/app/features/medications/components/medication-dots-strip.component.ts`
    - Inputs: `dates: string[]`, `statusForDate: (date: string) => 'taken' | 'not_taken' | null`
    - Render: same “taken / not-taken / not-logged” dot styles as the existing adherence page.
  - On Home, reuse the extracted component per active medication and link to full adherence.

- **Card: Incidents (last 7 days)**
  - Use `BehaviorIncidentService.listIncidents(participantId, { fromUtc, toUtc, pageSize: 100 })`.
  - Show:
    - Count (items length)
    - Up to 3 recent incidents with: date/time + place + function (minimal)
    - Actions: “Log incident” and “View incidents”

#### State / data flow (Angular 21)
- Use `httpResource` for data fetches; use signals for local UI state:
  - `todayLocalDate` as `YYYY-MM-DD` (local) for med logging.
  - `rangeDates` for 7-day dots (reuse existing local date formatting helpers).
  - A `refreshTick` signal to force resource refresh on successful upserts.
  - `savingMap` signal keyed by `medicationId` for button disabled state (reuse the pattern from `MedicationLogComponent`).
- Avoid duplicating date logic:
  - Extract local date formatting and 7-day range building into a small shared utility module (or reuse one implementation consistently).

#### Copy updates
- Replace “Dashboard” wording with “Home” throughout the UI (nav + headings).
- Keep the landing page copy focused on “Today” actions rather than user profile data.

### Validation + auth
- Guarded routes:
  - `/home` requires `AuthGuard` and the new active-participant guard.
- No new server validation.
- Ensure log writes continue to include `logTzOffsetMinutes` and store timestamps in UTC (already required by existing endpoints).

### Testing approach
- Unit tests (frontend):
  - Guard routing logic:
    - no active participant + zero participants → redirects to `/participants/start`
    - no active participant + has participants → redirects to `/participants`
    - active participant → allows `/home`
  - Date range helper for 7-day list (stable ordering and formatting).

- Manual checks (recommended):
  - `/` redirects to `/home`
  - `/dashboard` redirects/aliases to `/home`
  - Login flow lands on `/home`
  - With no participants: `/home` routes to `/participants/start`
  - With participants but none selected: `/home` routes to `/participants`
  - With active participant:
    - Home shows today’s meds; marking Taken/Not taken updates status without leaving the page
    - Home shows dots for 7 days for each active medication
    - Home shows incidents count + up to 3 recent incident previews
  - Build verification for FE changes via `dist/frontend/dev-frontend.log` (per `AGENTS.md` workflow).

## Sequencing
1. Add `/home` route + redirect `/` → `/home`; remove `/dashboard`; update login/nav links.
2. Implement `ActiveParticipantGuard` and apply it to `/home`.
3. Build Home component layout (Quick actions + scaffolding cards).
4. Implement Home meds resources + inline logging (reuse patterns from `MedicationLogComponent`).
5. Implement 7-day dots snapshot:
   - Extract dots strip component from `MedicationAdherenceComponent`
   - Use it in both Adherence and Home
6. Implement incidents last-7-days summary card (minimal preview).
7. Run through manual checks and verify FE build via `dist/frontend/dev-frontend.log`.

## Story-Tracking Checklist
### Story 1: Home landing route + naming
- [ ] Add `/home` route and set default redirect (`/`) to `/home`
- [ ] Remove `/dashboard` route
- [ ] Update nav label/link to “Home”
- [ ] Update login redirect to `/home`
- [ ] Add Home gating (active participant required)

### Story 2: Inline med logging on Home
- [ ] Fetch active medications for today (local date) and render checklist
- [ ] Fetch logs for today and derive status badge per medication
- [ ] Add one-tap “Taken / Not taken” actions (upsert + refresh)
- [ ] Handle save-in-progress + failure message
- [ ] Empty state: no meds → link to “Add medication”

### Story 3: 7-day adherence dots snapshot
- [ ] Compute last 7 local dates (including today)
- [ ] Fetch logs for the 7-day range
- [ ] Extract reusable dots strip component from adherence page
- [ ] Render dots per active medication on Home
- [ ] Link to full adherence page

### Story 4: Incidents last 7 days (minimal)
- [ ] Fetch incidents for last 7 days (UTC window)
- [ ] Show count + up to 3 recent incidents (date/time + place/function)
- [ ] Provide “Log incident” and “View incidents” actions

### Story 5: Setup-first routing/empty states
- [ ] `/home` redirects to `/participants/start` when no participants exist
- [ ] `/home` redirects to `/participants` when participants exist but none selected
- [ ] Error states for meds/logs/incidents show clear next step (retry or link)
