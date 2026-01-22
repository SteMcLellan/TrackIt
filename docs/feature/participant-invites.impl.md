# Implementation Plan: Participant Invites (Share Participant)

## Scope Recap
- Enable a lightweight invite flow so multiple signed-in users can access/manage the same participant.
- MVP:
  - A participant manager can generate a single-use invite link that expires after 7 days (out-of-band sharing).
  - A signed-in user can accept the invite and become associated to the participant.
  - Managers can view the participant member list and revoke another user’s access.
- Non-goals (MVP):
  - TrackIt sending email/SMS/push notifications.
  - Fine-grained roles/permissions beyond the current `manager|viewer` model (treat accepted users as `manager`).
  - “Invite by email” targeting (optional future phase).

## Assumptions / Open Questions
- **Invite format:** MVP uses an unguessable link containing `{participantId}` + `{inviteId}` (no separate “enter code” UX).
- **Invite management model (decision):** Creating a new invite revokes any existing unconsumed invites for the participant (reduces leaked-link risk and keeps UX simple).
- **Member visibility:** Member list shows `name` + `picture` (and a “me” label). Do not show raw email in the UI by default.
- **Safety / foot-guns:**
  - Managers cannot revoke themselves (MVP) to avoid accidental lockout.
  - Managers cannot remove the last remaining manager (MVP).
- **Audit field naming:** Existing models use `createdAt` (UTC ISO). For this feature, keep `createdAt`/`expiresAt` naming consistent with existing containers (still UTC).
- **Member listing data access (Cosmos):** We already have `userParticipantLinks` (partition key: `/userId`). For MVP, listing “members for a participant” will use a cross-partition query on `participantId`. If this becomes a perf/RU issue, add a follow-up “reverse index” container partitioned by `/participantId`.

## Technical Plan
### Data model changes
Types (TypeScript type aliases; align to current API models and UTC timestamp conventions):

```ts
export type ParticipantRole = 'manager' | 'viewer';

export type ParticipantInviteDocument = {
  id: string; // inviteId, e.g. invite_<uuid>
  participantId: string;
  createdAt: string; // ISO 8601 UTC, ends with Z
  createdByUserId: string;
  expiresAt: string; // ISO 8601 UTC, ends with Z (createdAt + 7 days)
  revokedAt?: string; // ISO 8601 UTC, ends with Z
  revokedByUserId?: string;
  consumedAt?: string; // ISO 8601 UTC, ends with Z
  consumedByUserId?: string;
};
```

Cosmos containers + partition keys:
- New container: `participantInvites` (partition key: `/participantId`)
- Existing container (already in use): `userParticipantLinks` (partition key: `/userId`)
- Existing container: `users` (partition key: `/id`)

Notes:
- Partitioning invites by `participantId` allows point reads on accept because the invite link includes `{participantId}`.
- Member listing for a participant will query `userParticipantLinks` by `participantId` (cross-partition) for MVP.

### API shape and endpoints
New / updated endpoints:
- Create invite (manager-only)
- Accept invite (signed-in users)
- List members (manager-only)
- Revoke member access (manager-only)

Shared envelopes:
```ts
export type CollectionResponse<T> = {
  items: T[];
  nextToken: string | null;
};
```

Response types:
```ts
export type ParticipantInviteResponse = {
  participantId: string;
  inviteId: string;
  expiresAt: string; // UTC ISO
};

export type ParticipantMemberResponse = {
  userId: string;
  role: ParticipantRole;
  name: string;
  picture?: string;
  isMe: boolean;
  addedAt: string; // UTC ISO
};

export type AcceptInviteResponse = {
  participantId: string;
  participantDisplayName?: string;
  alreadyLinked: boolean;
};
```

#### API Contract Template
### POST /api/participants/{participantId}/invites
Auth: app JWT; requires participant link with `role === 'manager'`
Request: none
Response: `ParticipantInviteResponse`
Errors: 400 (invalid participantId), 401, 403, 404

Server behavior:
- Validate caller is a manager for `{participantId}`.
- Revoke any existing unconsumed invites for this participant (set `revokedAt/revokedByUserId`).
- Create a new invite:
  - `inviteId = invite_<uuid>`
  - `expiresAt = now + 7 days`
- Return invite metadata (frontend constructs the actual share URL).

### POST /api/participants/{participantId}/invites/{inviteId}/accept
Auth: app JWT (must be signed in)
Request: none
Response: `AcceptInviteResponse`
Errors: 400 (invalid ids), 401, 403 (invite invalid/expired/revoked/consumed), 404 (participant not found)

Server behavior:
- Read invite by point read: `participantInvites.item(inviteId, participantId)`.
- Reject if:
  - `expiresAt < now`, or
  - `revokedAt` is set, or
  - `consumedAt` is set (single-use)
- If user is already linked to participant:
  - return `alreadyLinked: true` (do not consume the invite again).
- Otherwise, create association records:
  - Upsert `userParticipantLinks` (pk `/userId`) with role `manager`.
- Consume the invite by setting `consumedAt/consumedByUserId` using optimistic concurrency (ETag / If-Match) to prevent double-consume races.

### GET /api/participants/{participantId}/members
Auth: app JWT; requires participant link with `role === 'manager'`
Request: none
Response: `CollectionResponse<ParticipantMemberResponse>` (single page is fine for MVP; keep envelope for consistency)
Errors: 400, 401, 403, 404

Server behavior:
- Query `userParticipantLinks` by `participantId` (cross-partition; no partitionKey provided).
- For each `UserParticipantLinkDocument.userId`, point-read `users.item(userId, userId)` to fetch `name/picture` for display.
- Return members with `isMe` derived from `user.sub`.

### DELETE /api/participants/{participantId}/members/{userId}
Auth: app JWT; requires participant link with `role === 'manager'`
Request: none
Response: 204 No Content
Errors: 400, 401, 403, 404, 409 (attempt to remove last manager), 400 (attempt to remove self in MVP)

Server behavior:
- Disallow removing self (MVP).
- Disallow removing the last manager (MVP) by checking member count/roles for the participant before delete (cross-partition query on `userParticipantLinks` filtered by `participantId`).
- Delete from `userParticipantLinks`:
  - `userParticipantLinks.item(`${userId}:${participantId}`, userId).delete()` (matching existing id format)

### Frontend / UI changes
Screens / routes:
- Add an invite accept route, e.g.:
  - `/invite/:participantId/:inviteId` (protected by `AuthGuard`)

Components:
- `InviteAcceptComponent` (new):
  - On load, calls `POST /participants/{participantId}/invites/{inviteId}/accept`.
  - Shows success state + next actions:
    - “Set as active participant” (default-on behavior is acceptable; if chosen, call `ParticipantService.setActiveParticipant(participantId)`).
    - “Go to participant” and “Back to participants”.
  - Shows clear error states for invalid/expired/used invites (“Ask the manager to generate a new invite”).
- Update `ParticipantDetailComponent` (manager-only section):
  - “Share / Invite”:
    - “Copy invite link” button which calls `POST /participants/{id}/invites`, then builds a share URL:
      - `${window.location.origin}/invite/${participantId}/${inviteId}`
    - Display “Expires …” using the returned `expiresAt` (derived to friendly text in UI).
  - “Members”:
    - List members from `GET /participants/{id}/members` with “me” label.
    - “Revoke access” action per member (disabled for “me”); confirm modal.

State / data flow:
- Add API helpers in a new `ParticipantInviteService` or extend `ParticipantService`:
  - `createInvite(participantId)`
  - `acceptInvite(participantId, inviteId)`
  - `listMembers(participantId)`
  - `revokeMember(participantId, userId)`
- Use `httpResource` for read flows (members), and imperative HTTP calls for actions (create invite, accept invite, revoke).

Auth / redirect behavior (required for invite acceptance):
- Update `AuthGuard` to preserve a return URL:
  - When unauthenticated, navigate to `/login?returnUrl=<attemptedUrl>`.
- Update `LoginComponent` to redirect to `returnUrl` after successful auth (default `/home`).

### Validation + auth
- All endpoints require app JWT except existing `/auth/*`.
- Authorization:
  - Invite creation and member management require that the caller is linked to the participant with `role === 'manager'`.
  - Invite acceptance requires authentication but does not require prior participant association.
- Validation:
  - Validate `{participantId}` and `{inviteId}` are non-empty and match expected prefixes (`participant_`, `invite_`) to reduce accidental misuse.
  - Enforce expiration window: 7 days.
  - Single-use enforcement via consumed fields + optimistic concurrency.

### Testing approach
- Manual / integration checks (primary, since no API test harness exists yet):
  - User A creates participant and generates invite link; verify UI shows expiry and copy works.
  - User B (signed out) opens invite link; is prompted to login and returns to invite acceptance.
  - After acceptance, user B sees participant in participants list.
  - Accepting again shows “already linked” (no duplicates).
  - Invite expires (simulate by editing expiresAt in dev) and returns a clear error.
  - Member list shows both users; user A can revoke user B; user B loses access (403 on participant APIs).
- API build verification:
  - `npm run build:api` succeeds.
- Frontend build verification:
  - `npm run dev:frontend:log` and confirm `dist/frontend/dev-frontend.log` contains “Application bundle generation complete”.

## Sequencing
1. Add Cosmos container (`participantInvites`) to `buildCosmos` + env var wiring.
2. Implement API endpoints (create invite, accept invite, list members, revoke member) + shared validation helpers.
3. Update frontend auth redirect handling (`returnUrl`) and add invite acceptance route/component.
4. Add “Share / Invite” and “Members” sections to participant detail UI.
5. Manual verification of the end-to-end flow (two users) + log/build checks.

## Story-Tracking Checklist
### Story 1: Generate an invite
- [x] API: `POST /participants/{participantId}/invites` creates a single-use, 7-day invite (revokes previous unconsumed invites).
- [x] UI: Participant detail shows “Copy invite link” and clearly communicates “anyone with link can join”.
- [x] UI: Expiration is displayed (friendly) based on `expiresAt`.

### Story 2: Accept an invite
- [x] Frontend: invite route exists (`/invite/:participantId/:inviteId`) and calls accept endpoint.
- [x] Auth: unauthenticated users are redirected to login and returned to the invite route after login.
- [x] API: accept is idempotent for already-linked users (no duplicates).
- [x] UI: success state offers "Set as active participant" and navigation actions.
- [x] UI: invalid/expired/used invites show a clear error + next action.

### Story 3: View participant members
- [x] API: `GET /participants/{participantId}/members` returns member list for managers only.
- [x] UI: Participant detail shows members list, marks "me", and avoids showing emails by default.

### Story 4: Revoke access
- [x] API: `DELETE /participants/{participantId}/members/{userId}` removes association from both link containers.
- [x] UI: revoke is a secondary action with a confirmation step.
- [x] Safety: cannot revoke self (MVP) and cannot remove the last manager (MVP).
