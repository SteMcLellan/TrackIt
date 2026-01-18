# Feature Spec: Participant Invites (Share Participant)

## Feature Summary
Parents sometimes need multiple accounts to collaborate on the same participant (e.g., two parents/caregivers tracking the same child). Today, only the creating user can access a participant unless additional associations are created manually (not supported in UX). This feature adds a simple, dependency-light "invite" flow so additional signed-in users can associate to an existing participant.

## Rollout / Scope
- MVP in scope:
  - A participant manager can generate an invite for a participant.
  - Another signed-in user can accept the invite and become associated to that participant.
  - Invites are single-use and expire after 7 days.
  - For now, all associated users have the same abilities (treat everyone as a manager).
  - Basic member management: view who has access; revoke access.
  - Invite delivery is out-of-band (copy link, text message, chat) with no SMTP dependency.
- Out of scope:
  - Sending emails/SMS/push notifications from TrackIt.
  - Organization/team features or enterprise-style admin workflows.
  - Fine-grained permissions/roles beyond the initial "everyone is a manager" model.
- Phasing / rollout notes (optional):
  - Phase 1: generic "share code/link" invite (fast, no identity targeting).
  - Phase 2 (optional): "invite by email (Google account)" where an invite is restricted to a verified Google email, still without sending email from TrackIt.

## User Stories
1. As a participant manager, I can generate an invite for a participant so another caregiver can get access.
2. As a caregiver, I can accept an invite (code or link) so the participant appears in my participant list.
3. As a participant manager, I can see who has access to a participant so I can manage sharing safely.
4. As a participant manager, I can revoke access so I can keep control of who can edit.

## User Story Details
### 1) Generate an invite
**User story**  
As a participant manager, I can generate an invite for a participant so another caregiver can get access.

**Important data flows and validations**
- Only users with manager access for the participant can create invites.
- Invites are single-use and time-limited (7 days) to reduce risk if a link/code leaks.
- A manager can generate a new invite even if previous ones exist (depending on chosen model).

**Acceptance criteria**
- From a participant context, a manager can generate an invite.
- The invite can be shared without TrackIt sending email/SMS (copy link).
- The UI clearly communicates that anyone with the invite can join and will have full access (same abilities as existing caregivers).
- The UI displays the invite expiration (7 days) clearly.

**UX notes**
- Add a "Share / Invite" section on the participant detail page for managers.
- Primary actions:
  - "Copy invite link"
- Show invite expiration in a friendly way (e.g., "Expires in 7 days" and/or a specific UTC timestamp/date).

### 2) Accept an invite
**User story**  
As a caregiver, I can accept an invite link so the participant appears in my participant list.

**Important data flows and validations**
- A user must be authenticated to accept an invite.
- Accepting an invite creates an association to the participant with full access (manager, until roles exist).
- Invites are single-use to prevent unintended sharing (consume on successful acceptance).
- The system should handle "already associated" gracefully.

**Acceptance criteria**
- If I open an invite link while signed out, I'm prompted to sign in and then returned to the invite accept flow.
- If I open a valid invite link while signed in, the app associates me to the participant automatically (with clear confirmation).
- After acceptance, the participant appears in my participants list immediately.
- If I'm already associated, accepting does not create duplicates and shows a clear message.
- Invalid/expired/used invites show a clear error with a next action (e.g., "Ask the manager to generate a new invite").

**UX notes**
- After accepting, offer:
  - "Set as active participant" (optional default-on)
  - "Go to participant" vs "Back to participants"

### 3) View participant members
**User story**  
As a participant manager, I can see who has access to a participant so I can manage sharing safely.

**Important data flows and validations**
- Only managers can view the member list (until roles exist, everyone is effectively a manager).
- Member entries should use minimal identity data by default.

**Acceptance criteria**
- A manager can view a list of associated users for the participant.
- The UI indicates which user is "me".

**UX notes**
- Put "Members" near "Share / Invite".
- Prefer showing a friendly display name; avoid showing raw emails unless the user explicitly opts in.
- Consider adding "Added on" (derived from UTC) if we have reliable createdAt on the association.

### 4) Revoke access
**User story**  
As a participant manager, I can revoke access so I can keep control of who can edit.

**Important data flows and validations**
- A manager can revoke another user's access to the participant.
- Prevent foot-guns (decision): e.g., whether we allow a user to remove themselves, and whether we block removing the last remaining manager.

**Acceptance criteria**
- A manager can revoke another user's access to the participant.
- The UI confirms destructive actions (revoke) to prevent mistakes.

**UX notes**
- Revoke should be a secondary action with a confirm step.

## Open Questions
- Invite targeting:
  - Do we add an optional "restrict to a specific verified Google email" mode?
  - If yes, do we show the email in UI (privacy tradeoff)?
- Member visibility:
  - What identity fields do we show in the member list (display name only vs display name + email)?
  - Do we show when each member was added?
- Safety:
  - Should managers be able to revoke an invite before it's used (invalidate token)?
  - Can a manager remove themselves? If yes, do we require that another manager exists?
- Invite management:
  - Do we allow multiple active invites per participant at once?

## Decisions (optional)
- Invites are single-use and expire after 7 days.
- Until roles are introduced, all associated users have the same abilities (treat everyone as a manager).

## Technical Considerations (optional)
- This feature should not rely on SMTP or any reliable sender. "Invite" delivery is out-of-band (copy link/code, QR).
- All timestamps related to invite creation/expiration should be stored/processed in UTC.
