# Profile Caregiver Action Hierarchy

## Summary

The caregiver access card on the Profile Dashboard is visually dense. Invite link, expiry, copy, share, and member list information all compete for attention in a small area with no clear primary action hierarchy. A user looking to invite a caregiver should be able to identify and execute the primary action immediately.

## Job to Be Done

When I visit my profile to manage caregiver access, I want a single obvious next action to stand out, so I can invite a new caregiver or share access without having to parse a cluttered set of controls to find what to do.

## Required Behaviors

- The caregiver invite card has one visually dominant primary action (e.g. "Invite Caregiver" or "Copy Invite Link").
- Secondary information — expiry, current member list — is present but visually subordinate to the primary action.
- Copy and share actions are available but grouped or de-emphasized relative to the primary call to action.
- The existing member list remains accessible within the card without overwhelming the primary action.
- The read-only-first profile approach is preserved: editing caregiver access is an intentional action, not the default view state.

## Acceptance Criteria

- A first-time user can identify the primary action for inviting a caregiver without reading all card content.
- The invite link, expiry, copy, and share controls are present and functional but do not compete equally with the primary action.
- The caregiver member list is visible or one tap away, but its presence does not crowd the primary action.
- The card validates at 375px and 390px without overflow, clipping, or horizontal scroll.

## Out of Scope

- Changes to the invite link generation logic or expiry duration.
- Changes to caregiver permission levels or role definitions.
- Redesign of non-caregiver sections of the Profile Dashboard.

## Doc Updates on Completion

- `docs/backlog/multi-caregiver-mvp.md` — if the implemented hierarchy makes decisions about caregiver invite UX that are relevant to the broader multi-caregiver work, record them to inform that future effort.
- `docs/backlog/ui-feedback-general.md` — mark issue 6 (Profile action hierarchy is crowded) resolved.

## References

- `docs/architecture/frontend-interaction-principles.md` — thumb-friendly actions, read-only display by default
- `docs/backlog/multi-caregiver-mvp.md`
- `docs/specs/shell-viewport-normalization.md`
