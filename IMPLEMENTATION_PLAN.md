# TrackIt Implementation Plan

Last updated: 2026-03-21 (code-verified against specs in docs/specs/)

---

## Priority 6 — Documentation: Align Product Spec with API Contract (behavior-incidents-2.md)

> **Low urgency** — no runtime impact, but keeps the spec accurate for future agents.

- [ ] **Update `docs/product-specs/behavior-tracking-abc.md` list query params**
  - File: `docs/product-specs/behavior-tracking-abc.md`
  - Line 48: Replace `fromUtc`, `toUtc` (ISO 8601 UTC) with `startDate`, `endDate` (YYYY-MM-DD local dates) in the API surface section.

---

## Completed

- [x] **clerk-auth-1.md** — Clerk frontend login: `ClerkService` + `LoginComponent` with Clerk widget implemented. Confirmed by git commit `feat(login): use clerk`.
- [x] **Priority 1** — Bug: Behavior Incident Filter Contract (behavior-incidents-2.md)
- [x] **Priority 2** — Bug: Daily Reflection Null-Score Defaults (daily-reflection-2.md)
- [x] **Priority 3** — Missing Feature: Medications Summary Card Interval Support (medications-summary-2.md)
- [x] **Priority 4** — Missing Feature: Today's Reflection Card on Insights (insights-today-reflection.md)
- [x] **Priority 5** — Missing Routes: Incident List, Detail, and New (behavior-incidents-2.md)
