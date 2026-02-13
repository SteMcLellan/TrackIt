# Stitch Migration Tracker

TrackIt Stitch project: `projects/2002730124455423542`

This document tracks migration progress from legacy frontend components to Stitch-backed designs.

- Scope: all Angular components under `frontend/src/app/**/*.component.ts`
- Status model: `Converted` or `Not`
- Update this file in the same PR as any Stitch conversion change.
- Validate consistency with `npm run audit:stitch-migration`.

## Coverage Summary

- Total components: `63`
- Converted: `9`
- Not converted: `54`
- Completion: `14.3%` (`9/63`)

## Component Inventory

| Component Path | Converted | Stitch Screen | Notes |
| --- | --- | --- | --- |
| frontend/src/app/app.component.ts | No | - | - |
| frontend/src/app/features/analytics/analytics.component.ts | No | - | - |
| frontend/src/app/features/auth/login.component.ts | Yes | projects/2002730124455423542/screens/40de48a457ef43beab1f50b6742a7664 | TrackIt Trendline Logo Identity |
| frontend/src/app/features/daily-reflection/daily-reflection.component.ts | Yes | projects/2002730124455423542/screens/57dc91ea7516465ea3bb05ba8f35b7d9 | Daily Reflection Entry |
| frontend/src/app/features/dashboard/dashboard.component.ts | No | - | - |
| frontend/src/app/features/home/home.component.ts | No | - | - |
| frontend/src/app/features/insights/insights-dashboard.component.ts | Yes | projects/2002730124455423542/screens/efcaceb73e4746e2a655f9d447f9f420 | Parental Insight Dashboard |
| frontend/src/app/features/insights/insights-placeholder.component.ts | No | - | - |
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
| frontend/src/app/features/timeline/timeline-placeholder.component.ts | No | - | - |
| frontend/src/app/shell/bottom-nav.component.ts | Yes | projects/2002730124455423542/screens/efcaceb73e4746e2a655f9d447f9f420 | Parental Insight Dashboard shell navigation |
| frontend/src/app/shell/shell.component.ts | Yes | projects/2002730124455423542/screens/efcaceb73e4746e2a655f9d447f9f420 | Parental Insight Dashboard shell layout |
| frontend/src/app/shell/top-bar.component.ts | Yes | projects/2002730124455423542/screens/efcaceb73e4746e2a655f9d447f9f420 | Parental Insight Dashboard top app bar |
| frontend/src/app/shared/ui/card.component.ts | No | - | - |
| frontend/src/app/shared/ui/charts/bar-chart.component.ts | No | - | - |
| frontend/src/app/shared/ui/charts/donut-chart.component.ts | No | - | - |
| frontend/src/app/shared/ui/charts/horizontal-bar-chart.component.ts | No | - | - |
| frontend/src/app/shared/ui/chip-selector.component.ts | No | - | - |
| frontend/src/app/shared/ui/filters/date-range-selector.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/analytics-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/arrow-right-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/checkmark-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/chevron-right-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/close-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/function-attention-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/function-escape-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/function-sensory-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/function-tangible-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/home-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/incidents-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/medications-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/menu-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/notes-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/participants-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/plus-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/timeline-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/trackit-logo-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/icons/trackit-trendline-logo-icon.component.ts | Yes | projects/2002730124455423542/screens/40de48a457ef43beab1f50b6742a7664 | Brand logo mark from TrackIt Trendline Logo Identity |
| frontend/src/app/shared/ui/icons/x-icon.component.ts | No | - | - |
| frontend/src/app/shared/ui/page/bottom-nav.component.ts | No | - | - |
| frontend/src/app/shared/ui/page/bottom-sheet.component.ts | Yes | projects/2002730124455423542/screens/f26e44666b8e4077a45861d9aee62025 | Profile screen bottom sheet overlay |
| frontend/src/app/shared/ui/page/context-bar.component.ts | No | - | - |
| frontend/src/app/shared/ui/page/page-header.component.ts | No | - | - |
| frontend/src/app/shared/ui/page/page-title.component.ts | No | - | - |
| frontend/src/app/shared/ui/page/top-sheet-menu.component.ts | No | - | - |
| frontend/src/app/shared/ui/skeleton.component.ts | No | - | - |
