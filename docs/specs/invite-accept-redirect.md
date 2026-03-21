# Invite Accept: Post-Acceptance Redirect

## Summary

`InviteAcceptComponent` navigates to `/home` after a successful invite acceptance, but `/home`
is not a registered route. The user lands on a blank/error page instead of the app dashboard.

## User job

A new caregiver receives an invite link, opens it, accepts the invite, and expects to land in
the app — not on a broken page.

## Required behaviors

- After successfully accepting a participant invite, the user is navigated to `/insights`.
- The `already-linked` state (user already has access) also redirects to `/insights`.
- No navigation target of `/home` remains anywhere in the invite acceptance flow.

## Acceptance criteria

- [ ] After accepting a valid invite, the user is navigated to `/insights`.
- [ ] The `already-linked` success path navigates to `/insights` (not `/home`).
- [ ] No `router.navigate(['/home'])` call remains in `invite-accept.component.ts`.
- [ ] TypeScript build passes with no errors.

## Out of scope

- Changes to invite creation, sharing, or expiry logic.
- Changes to the invite acceptance screens beyond the redirect target.
- Caregiver role or permission changes.

## References

- `frontend/src/app/features/invites/invite-accept.component.ts`
- `frontend/src/app/app.routes.ts`
