# Implementation Plan: Mobile UI Density Refresh

## Scope Recap
- Reduce perceived UI density across phone and tablet screens with clearer spacing and hierarchy.
- Replace the busy header + context bar with a single top bar and a top sheet menu.
- Move participant context into the top sheet drawer; remove app title text from the bar.
- Improve tap targets, button groups, and list/card spacing across high-traffic screens.

## Assumptions / Open Questions
- Which screens beyond Home and Medication check-in should be prioritized first (Incidents, Participants, etc.)?
- Should we keep the base font size unchanged or increase it slightly on mobile?
- Top sheet trigger behavior is intentionally unspecified for now; we will implement a simple affordance and iterate.
- Header visibility on the login route: keep the logo-only bar or hide entirely?

## Technical Plan
### Data model changes
- Types:
  - None.
- Cosmos containers + partition keys:
  - None.

### API shape and endpoints
- New / updated endpoints:
  - None.

### Frontend / UI changes
- Screens / routes:
  - App shell header and navigation in `frontend/src/app/app.component.ts`.
  - Remove `app-context-bar` from the shell and move participant context into the top sheet menu.
  - Apply density updates to Home and Medication check-in screens first:
    - `frontend/src/app/features/home/home.component.ts`
    - `frontend/src/app/features/medications/components/medication-checkin.component.ts`
    - `frontend/src/app/features/medications/medication-log.component.ts`
    - `frontend/src/app/features/medications/medication-list.component.ts`
- Components:
  - Create a new standalone `app-menu` (top sheet) component under `frontend/src/app/shared/ui/` or refactor `context-bar` into a menu component.
  - Use the provided SVG mark inline in the header (24-28px) with centered alignment.
  - If `AppComponent` is edited, convert its template/styles to inline to follow repo conventions.
- State / data flow:
  - Reuse `ParticipantService` and existing participant fetch logic for menu display.
  - Keep auth gating so menu content only renders for authenticated users.
- Styling / spacing:
  - Introduce a small spacing scale via CSS custom properties (e.g., `--space-1`..`--space-6`) in `frontend/src/styles.css`.
  - Update shared UI elements (card padding, button groups, list rows) to use the spacing scale and add responsive tweaks for phone/tablet.
  - Ensure tap targets meet minimum height (44px) for primary actions.

### Validation + auth
- Continue using existing auth guards and signals for auth checks.
- Top sheet menu should not expose protected actions when unauthenticated.

### Testing approach
- Unit tests:
  - None required.
- Integration tests:
  - None required.
- E2E / manual checks:
  - Verify on phone and tablet breakpoints (e.g., 428x926, 768x1024).
  - Check header + top sheet: open/close, focus, and keyboard escape behavior.
  - Validate tap targets and spacing on Home and Medication screens.
  - Confirm participant switch and logout actions remain reachable.

## Sequencing
1. Add spacing tokens in `frontend/src/styles.css` and identify common spacing updates.
2. Refactor the app shell header into a logo-only top bar and remove `app-context-bar`.
3. Implement the top sheet menu component (participant context, nav, account actions).
4. Apply spacing and tap-target adjustments to Home and Medication screens.
5. Expand density improvements to secondary screens (Participants, Incidents, etc.).
6. Manual QA on phone + tablet breakpoints and tighten spacing as needed.

## Story-Tracking Checklist
### Story 1: Tap-friendly primary actions
- [x] Increase button height and spacing for primary actions on mobile/tablet.
- [x] Update multi-button groups to wrap or stack at smaller widths.
- [x] Verify one-handed use on the medication check-in actions (manual QA at 428x926 and 768x1024).

### Story 2: Calm, scannable content blocks
- [x] Adjust card/list spacing and header hierarchy in Home and Medication screens.
- [x] Reduce visual clutter by using consistent vertical rhythm and separators.
- [x] Confirm "today" emphasis is clear without extra noise.

### Story 3: Lighter top chrome
- [ ] Replace the current header + context bar with a single top bar.
- [ ] Remove the secondary white header and any duplicate metadata.

### Story 4: Consistent mobile spacing system
- [ ] Define spacing tokens and apply them across shared components.
- [ ] Ensure similar elements share consistent padding/margins across screens.

### Story 5: Single header with menu drawer
- [ ] Build a top sheet menu with participant switching, nav links, and account actions.
- [ ] Center the logo-only mark in the top bar and omit the app title text.
- [ ] Keep participant context inside the menu only.
