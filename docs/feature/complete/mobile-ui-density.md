# Feature Spec: Mobile UI Density Refresh

## Feature Summary
- Problem / why now: The current mobile UI feels cramped, making it harder to scan and tap, and reducing confidence in daily check-ins.
- Primary users: Parents/caregivers using TrackIt on phones and tablets for daily tracking and medication check-ins.
- Desired outcome: Phone and tablet screens feel calmer, more readable, and easier to tap without increasing navigation friction.

## Rollout / Scope
- MVP in scope:
  - Mobile and tablet layout and spacing refinements across the app (global nav, participant header, cards, lists, button groups, and form controls).
  - Typography and visual hierarchy adjustments to improve scanning on small screens and tablets.
  - Touch target and tap spacing improvements for primary actions.
- Out of scope:
  - New features, new data models, or workflow changes.
  - Desktop-only redesign or brand overhaul.
- Phasing / rollout notes (optional):
  - Phase 1: Navigation + header density pass.
  - Phase 2: Core tracking screens (Home, Medication check-in, logs).
  - Phase 3: Secondary screens (Participants, Settings, etc.).

## User Stories
1. As a caregiver on a phone, I want key actions to be easy to tap so I can log quickly without mis-taps.
2. As a caregiver, I want clearer visual grouping so I can scan today’s tasks without feeling overwhelmed.
3. As a caregiver, I want the top navigation and participant header to feel lighter so I can focus on content.
4. As a caregiver, I want consistent spacing across screens so the app feels calm and predictable.
5. As a caregiver, I want a single, simple header with a menu that contains navigation and participant switching.

## User Story Details
### 1) Tap-friendly primary actions
**User story**  
As a caregiver on a phone, I want key actions to be easy to tap so I can log quickly without mis-taps.

**Important data flows and validations**
- No changes to data or validation logic.

**Acceptance criteria**
- Primary buttons on mobile have comfortable tap targets and sufficient spacing from adjacent controls.
- Multi-button groups do not feel crowded and reduce accidental taps.
- The “Taken / Not taken” interaction can be completed with one-handed use without zooming.

**UX notes**
- Favor fewer buttons per row on small screens; allow wrapping when needed.
- Prioritize the most common action visually and spatially.

### 2) Calm, scannable content blocks
**User story**  
As a caregiver, I want clearer visual grouping so I can scan today’s tasks without feeling overwhelmed.

**Important data flows and validations**
- No changes to data or validation logic.

**Acceptance criteria**
- Card content (titles, subtitles, badges, list items) has clearer vertical rhythm.
- Section headers are visually distinct without dominating the page.
- Dense list rows have increased breathing room and clear separation.

**UX notes**
- Use consistent vertical spacing between sections.
- Emphasize “today” and current status without adding clutter.

### 3) Lighter top chrome
**User story**  
As a caregiver, I want the top navigation and participant header to feel lighter so I can focus on content.

**Important data flows and validations**
- No changes to data or validation logic.

**Acceptance criteria**
- Navigation and participant header consume less vertical space on mobile.
- The signed-in identity and participant context remain visible but do not crowd the content.
- The “switch participant” affordance remains easy to find and tap.

**UX notes**
- Consider stacking or collapsing secondary metadata in the header.
- Avoid multiple rows of small text at the top on phone widths.

### 4) Consistent mobile spacing system
**User story**  
As a caregiver, I want consistent spacing across screens so the app feels calm and predictable.

**Important data flows and validations**
- No changes to data or validation logic.

**Acceptance criteria**
- Spacing feels consistent across Home, Medication check-in, and other high-traffic screens.
- Similar UI elements (cards, lists, buttons) share the same spacing behavior.
- No new cramped areas introduced by the change.

**UX notes**
- Apply a small, consistent spacing scale for mobile.
- Prefer fewer, stronger spacing rules over many one-off tweaks.

### 5) Single header with menu drawer
**User story**  
As a caregiver, I want a single, simple header with a menu that contains navigation and participant switching.

**Important data flows and validations**
- No changes to data or validation logic.

**Acceptance criteria**
- The app uses a single top bar across breakpoints with a centered, minimal logo-only treatment.
- The app title text is not shown in the top bar.
- The secondary (white) header is removed.
- A menu affordance opens a top sheet drawer that includes:
  - Participant switch action.
  - Primary navigation links to other areas.
  - Account actions (e.g., logout) grouped separately.
- The drawer is usable one-handed on mobile and does not feel crowded.
- The logo mark does not use a background circle and remains readable at 24–28px.

**UX notes**
- Keep the top bar minimal; no additional rows of metadata.
- Participant context lives only in the drawer to reduce top-bar clutter.
- Slightly emphasize any tracking dots so they remain visible at 24px.
- The drawer should feel light and not overly tall on mobile.

## Open Questions
- Which screens are highest priority after Home and Medication check-in?
- Do we want a slightly larger base font size on mobile for readability?

## Decisions (optional)
- None yet.

## Logo Mark (spec asset)
Use this SVG for the logo-only top bar treatment (no background circle):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path
    d="M7.2 12.6 L10.5 15.9 L16.9 8.6"
    fill="none"
    stroke="#ffffff"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle cx="16.8" cy="14.8" r="1.1" fill="#ffffff"/>
  <circle cx="18.6" cy="13.1" r="0.9" fill="#ffffff"/>
</svg>
```
