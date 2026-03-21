# Multi-Caregiver MVP

Status: Ready to implement
Last updated: 2026-03-03

## Overview

The invite infrastructure is in place end-to-end (invite link generation, `InviteAcceptComponent`, manager/viewer roles at the API layer), but several gaps block real shared use. This doc captures the MVP features needed before inviting other caregivers to use the app.

---

## 1. Members List and Revoke Access UI

### Problem

The API supports listing members (`GET /participants/{id}/members`) and revoking access (`DELETE /participants/{id}/members/{userId}`), but there is no UI for either. Managers can invite caregivers in but cannot see who has access or remove anyone.

### What to build

Add a "Who has access" section to the Caregiver Access card in the Profile page (manager-only view):

- List each linked caregiver by name and role (manager / viewer).
- Show the current user's own entry with a "(you)" label — no revoke button on self.
- Revoke button on each other member.
- Confirmation step before revoke executes (inline confirmation, not a modal).

### Acceptance criteria

- [ ] Manager sees a list of all linked caregivers with names and roles.
- [ ] Each non-self member has a Revoke button.
- [ ] Revoking requires an inline confirm step before the API call fires.
- [ ] Revoking a member removes them from the list without a full page reload.
- [ ] Viewer role users do not see the member list or revoke controls.
- [ ] Own entry shows "(you)" and has no revoke option.

---

## 2. Participant Setup for New Users

### Problem

`docs/architecture/participant-association.md` describes `/participants/start` and `/participants/new` routes as the first-run flow, but neither route exists in `app.routes.ts`. All main routes are guarded by `ActiveParticipantGuard`. A brand new user who has not been invited anywhere — and has no linked participant — has no visible path to create one.

Invited users land on the app after accepting their invite and will have a participant linked automatically. But a net-new user who signs up independently is stuck with no route to follow.

### What to build

- Add a participant creation screen (name + birthdate) reachable when the user has no linked participants.
- `ActiveParticipantGuard` (or the shell) should redirect to this screen instead of blocking silently when no participant exists.
- After creating a participant, redirect to the insights dashboard with the new participant auto-selected.

### Acceptance criteria

- [ ] A user with no linked participants is redirected to the participant creation screen on first load.
- [ ] The creation screen collects display name (required) and birthdate (required).
- [ ] On successful creation, the new participant is auto-selected and the user lands on the insights dashboard.
- [ ] An invited user who already has a linked participant is never shown this screen.

---

## 3. Viewer Role UI Differentiation

### Problem

Viewers get the same UI as managers but find that edit actions either fail silently or are hidden without explanation. The only current viewer-aware copy is on the Caregiver Access card ("Only managers can manage caregiver invites"). Edit controls elsewhere are not role-aware.

### What to build

- In the Profile page, hide the participant Edit button and the medication Add/Edit/Archive controls for viewers.
- Show a brief "View only — contact the manager to make changes" note where edit controls would appear.
- No changes needed to tracking features (daily reflection, behavior logging, medication logging) — viewers should be able to log and reflect.

### Acceptance criteria

- [ ] Viewer cannot see participant Edit button on Profile.
- [ ] Viewer cannot see medication Add, Edit, or Archive controls.
- [ ] A "View only" note is visible to viewers in the Profile sections where edit controls are absent.
- [ ] Viewer can still submit daily reflections, log medication doses, and create behavioral moments.

---

## 4. Invite Link Context

### Problem

The Web Share payload reads `"Join me in TrackIt."` with no participant name. A co-parent receiving this as a text or email has no context about whose profile the invite is for.

### What to build

- Include the participant's display name in the share text: e.g., `"Join me in tracking Alex on TrackIt."`
- Update the share title similarly.
- No change to the invite link URL format.

### Acceptance criteria

- [ ] Share text includes the active participant's display name.
- [ ] If display name is not set, fall back to `"your child"`.

---

## 5. Caregiver Invite Action Hierarchy

### Decision (2026-03-21)

The Caregiver Access card uses a single dominant primary CTA to reduce scanning overhead:

- **When an invite exists:** "Copy Invite Link" is the primary filled violet pill button. "Share" is a secondary ghost-violet button alongside it. "Regenerate link" is a de-emphasized text link below.
- **When no invite exists:** "Generate Invite Link" is the primary filled violet pill button.
- "Regenerate" is removed from the card header entirely to preserve the header as read-only.

This hierarchy was established to meet the spec in `docs/specs/profile-caregiver-action-hierarchy.md`. Future work on the invite flow (e.g. invite context, item 4 above) should treat "Copy Invite Link" as the primary action and not elevate secondary actions to equal visual weight.

---

## Out of Scope for MVP

- Push or email notifications for invites — delivery remains manual (copy/share link).
- Granular permissions beyond manager/viewer.
- Multiple participants per invite link.
