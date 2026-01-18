# Feature Spec: Participant Invites (Share Participant)

## Feature Summary
Parents sometimes need multiple accounts to collaborate on the same participant (e.g., two parents/caregivers tracking the same child). Today, only the creating user can access a participant unless additional associations are created manually (not supported in UX). This feature adds a simple, dependency-light “invite” flow so additional signed-in users can associate to an existing participant.

## Rollout / Scope
- MVP in scope:
  - A participant **manager** can generate an invite for a participant.
  - Another signed-in user can accept the invite and become associated to that participant.
  - Basic member management: view who has access; revoke access; change role (manager/viewer).
  - Invite delivery is **out-of-band** (copy link, text message, chat) with no SMTP dependency.
- Out of scope:
  - Sending emails/SMS/push notifications from TrackIt.
  - Organization/team features or enterprise-style admin workflows.
  - Fine-grained permissions beyond `manager`/`viewer`.
- Phasing / rollout notes (optional):
  - Phase 1: generic “share code/link” invite (fast, no identity targeting).
  - Phase 2 (optional): “invite by email (Google account)” where an invite is restricted to a verified Google email, still without sending email from TrackIt.

## User Stories
1. As a participant manager, I can generate an invite for a participant so another caregiver can get access.
2. As a caregiver, I can accept an invite (code or link) so the participant appears in my participant list.
3. As a participant manager, I can see who has access to a participant so I can manage sharing safely.
4. As a participant manager, I can revoke access or change roles so I can keep control of who can edit.

## User Story Details
### 1) Generate an invite
**User story**  
As a participant manager, I can generate an invite for a participant so another caregiver can get access.

**Important data flows and validations**
- Only users with `role: manager` for the participant can create invites.
- Invites should be time-limited by default (to reduce risk if a link/code leaks).
- Invites should default to the least-privileged role (`viewer`) unless explicitly changed.
- A manager can generate a new invite even if previous ones exist (depending on chosen model).

**Acceptance criteria**
- From a participant context, a manager can generate an invite.
- The invite can be shared without TrackIt sending email/SMS (copy link).
- The manager can choose the invite role (`viewer` or `manager`) before sharing.
- The UI clearly communicates that anyone with the invite can potentially join (unless the invite is targeted).

**UX notes**
- Add a “Share / Invite” section on the participant detail page for managers.
- Primary actions:
  - “Copy invite link”
- Show invite expiration in a friendly way (e.g., “Expires in 24 hours”).

### 2) Accept an invite
**User story**  
As a caregiver, I can accept an invite link so the participant appears in my participant list.

**Important data flows and validations**
- A user must be authenticated to accept an invite.
- Accepting an invite creates an association to the participant with the role specified by the invite.
- Invites should be single-use or limited-use (decision) to prevent unintended sharing.
- The system should handle “already associated” gracefully.

**Acceptance criteria**
- If I open an invite link while signed out, I’m prompted to sign in and then returned to the invite accept flow.
- If I open a valid invite link while signed in, the app associates me to the participant automatically (with clear confirmation).
- After acceptance, the participant appears in my participants list immediately.
- If I’m already associated, accepting does not create duplicates and shows a clear message.
- Invalid/expired invites show a clear error with a next action (e.g., “Ask the manager to generate a new invite”).

**UX notes**
- After accepting, offer:
  - “Set as active participant” (optional default-on)
  - “Go to participant” vs “Back to participants”

### 3) View participant members
**User story**  
As a participant manager, I can see who has access to a participant so I can manage sharing safely.

**Important data flows and validations**
- Only managers can view the full member list (decision; alternative is to let viewers see a minimal list).
- Member entries should use minimal identity data by default.

**Acceptance criteria**
- A manager can view a list of associated users for the participant and each user’s role.
- The UI indicates which user is “me”.

**UX notes**
- Put “Members” near “Share / Invite”.
- Prefer showing a friendly display name; avoid showing raw emails unless the user explicitly opts in.

### 4) Revoke access / change roles
**User story**  
As a participant manager, I can revoke access or change roles so I can keep control of who can edit.

**Important data flows and validations**
- A manager can downgrade another manager to viewer and can revoke access.
- Prevent foot-guns (decision): e.g., blocking the last remaining manager from removing themselves.

**Acceptance criteria**
- A manager can change another user’s role between `manager` and `viewer`.
- A manager can revoke another user’s access to the participant.
- The UI confirms destructive actions (revoke) to prevent mistakes.

**UX notes**
- Role changes should be quick (dropdown or segmented control) with immediate feedback.
- Revoke should be a secondary action with a confirm step.

## Open Questions
- Invite format:
  - Single-use vs limited-use vs reusable until expiration?
  - Default expiration duration (e.g., 1 hour / 24 hours / 7 days)?
- Invite targeting:
  - Do we add an optional “restrict to a specific verified Google email” mode?
  - If yes, do we show the email in UI (privacy tradeoff)?
- Roles:
  - Is it acceptable for an invite to grant `manager`, or should invites always grant `viewer` and require promotion?
- Member visibility:
  - Should viewers see any member list (and if so, what minimal info)?
- Safety:
  - Should managers be able to revoke an invite before it’s used?

## Decisions (optional)
- None yet.

## Technical Considerations (optional)
- This feature should not rely on SMTP or any reliable sender. “Invite” delivery is out-of-band (copy link/code, QR).
- All timestamps related to invite creation/expiration should be stored/processed in UTC.
