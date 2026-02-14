# Stitch Migration Tracker

TrackIt Stitch project: `projects/2002730124455423542`

This document tracks migration progress from legacy frontend components to Stitch-backed designs.

## Scope

Not every component warrants a Stitch screen. Components are tiered:

- **Screen tier**: Feature page components — each maps to a distinct user-visible surface. Tracked here.
- **Pattern tier**: Shared UI components (cards, charts, chips, forms, shell sub-pieces) — governed by `DESIGN.md` patterns, not individual Stitch screens.
- **Atom tier**: Icon components, skeleton, and other implementation utilities — no Stitch involvement.

This tracker covers **Screen tier** components and the canonical **Shell** components only.

**Excluded by design:**

- `shared/ui/icons/*` — atoms
- `shared/ui/skeleton.component.ts`, `shared/ui/card.component.ts` — patterns
- `shared/ui/charts/*`, `shared/ui/chip-selector.component.ts`, `shared/ui/filters/*` — patterns
- `shared/ui/page/context-bar.component.ts`, `page-header.component.ts`, `page-title.component.ts`, `top-sheet-menu.component.ts` — patterns
- `shared/ui/page/bottom-nav.component.ts` — duplicate of `shell/bottom-nav.component.ts`
- `app.component.ts` — root component, not a design surface
- Placeholder components (`insights-placeholder`, `timeline-placeholder`) — consolidated into their primary screen entry

## Status model

- `Converted` — Stitch screen exists; code derives from it.
- `Not` — No Stitch screen yet.
- Update this file in the same PR as any Stitch conversion change.
- Validate consistency with `npm run audit:stitch-migration`.

## Coverage Summary

- Total in scope: `29`
- Converted: `9`
- Not converted: `20`
- Completion: `31.0%` (`9/29`)

## Component Inventory

| Component Path | Converted | Stitch Screen | Notes |
| --- | --- | --- | --- |
| frontend/src/app/features/analytics/analytics.component.ts | No | - | - |
| frontend/src/app/features/auth/login.component.ts | Yes | projects/2002730124455423542/screens/40de48a457ef43beab1f50b6742a7664 | TrackIt Trendline Logo Identity |
| frontend/src/app/features/daily-reflection/daily-reflection.component.ts | Yes | projects/2002730124455423542/screens/57dc91ea7516465ea3bb05ba8f35b7d9 | Daily Reflection Entry |
| frontend/src/app/features/dashboard/dashboard.component.ts | No | - | - |
| frontend/src/app/features/home/home.component.ts | No | - | - |
| frontend/src/app/features/insights/insights-dashboard.component.ts | Yes | projects/2002730124455423542/screens/efcaceb73e4746e2a655f9d447f9f420 | Parental Insight Dashboard |
| frontend/src/app/features/incidents/incident-create.component.ts | No | - | - |
| frontend/src/app/features/incidents/incident-detail.component.ts | No | - | - |
| frontend/src/app/features/incidents/incident-edit-form.component.ts | No | - | - |
| frontend/src/app/features/incidents/incident-list.component.ts | No | - | - |
| frontend/src/app/features/incidents/incident-list-item.component.ts | No | - | - |
| frontend/src/app/features/invites/invite-accept.component.ts | No | - | - |
| frontend/src/app/features/medications/medication-adherence.component.ts | No | - | - |
| frontend/src/app/features/medications/medication-checkin.component.ts | No | - | - |
| frontend/src/app/features/medications/medication-dots-strip.component.ts | No | - | - |
| frontend/src/app/features/medications/medication-list.component.ts | No | - | - |
| frontend/src/app/features/medications/medication-log.component.ts | No | - | - |
| frontend/src/app/features/participants/participant-create.component.ts | No | - | - |
| frontend/src/app/features/participants/participant-detail.component.ts | No | - | - |
| frontend/src/app/features/participants/participant-edit-form.component.ts | No | - | - |
| frontend/src/app/features/participants/participant-list.component.ts | No | - | - |
| frontend/src/app/features/participants/participant-start.component.ts | No | - | - |
| frontend/src/app/features/profile/profile-dashboard.component.ts | Yes | projects/2002730124455423542/screens/6a3a33ded32c4f688c10ff3f109a4623 | Profile Dashboard |
| frontend/src/app/features/timeline/timeline.component.ts | No | - | - |
| frontend/src/app/shell/bottom-nav.component.ts | Yes | projects/2002730124455423542/screens/efcaceb73e4746e2a655f9d447f9f420 | Parental Insight Dashboard shell navigation |
| frontend/src/app/shell/shell.component.ts | Yes | projects/2002730124455423542/screens/efcaceb73e4746e2a655f9d447f9f420 | Parental Insight Dashboard shell layout |
| frontend/src/app/shell/top-bar.component.ts | Yes | projects/2002730124455423542/screens/efcaceb73e4746e2a655f9d447f9f420 | Parental Insight Dashboard top app bar |
| frontend/src/app/shared/ui/icons/trackit-trendline-logo-icon.component.ts | Yes | projects/2002730124455423542/screens/40de48a457ef43beab1f50b6742a7664 | Brand logo mark from TrackIt Trendline Logo Identity |
| frontend/src/app/shared/ui/page/bottom-sheet.component.ts | Yes | projects/2002730124455423542/screens/f26e44666b8e4077a45861d9aee62025 | Profile screen bottom sheet overlay |
