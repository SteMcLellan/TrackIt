# Behavior Incident Routes and Filter Alignment

## Summary
Add the missing behavior incident list and detail routes to the frontend. Resolve the filter-parameter contract drift between the product spec, the API implementation, and the insights dashboard call.

## User job
Parents need to view, search, edit, and delete logged behavior incidents. Currently only the create flow is reachable in the app.

## Required behaviors

### Filter contract fix
- The API list endpoint (`GET .../incidents`) accepts `startDate` and `endDate` as `YYYY-MM-DD` local date strings. This is the canonical contract — it matches every other date-range endpoint in the API.
- The Insights dashboard currently calls the incidents endpoint with `fromUtc`/`toUtc` query params, which the API does not recognise. Fix the Insights call to use `startDate`/`endDate`.
- Update `docs/product-specs/behavior-tracking-abc.md` to reflect `startDate`/`endDate` (replacing `fromUtc`/`toUtc`) so the product spec matches the implementation.

### Frontend routes
- `/incidents` — list view with date-range and function filters, paginated newest to oldest.
- `/incidents/:id` — detail view with edit and delete options; edit mode opens the same form as create.
- `/incidents/new` — create incident (rename from `/behavioral-moments/new` or add alias).

### List view
- Filters: date range (e.g. last 7 / 30 / 90 days) and function (sensory / tangible / escape / attention).
- Each row: date/time, ABC summary line, function label.
- Tapping a row navigates to `/incidents/:id`.

### Detail / edit view
- Shows A, B, C, place, function, and date/time.
- Edit and Delete actions available.
- Delete requires a confirmation step.

## Acceptance criteria
- [ ] `/incidents` list loads and paginates incidents for the active participant.
- [ ] Date-range and function filters apply correctly.
- [ ] Tapping an incident row opens the detail view.
- [ ] Detail view shows all incident fields.
- [ ] Edit saves changes and returns to detail.
- [ ] Delete removes the incident and returns to the list.
- [ ] Insights dashboard incident call uses `startDate`/`endDate`, not `fromUtc`/`toUtc`.
- [ ] `docs/product-specs/behavior-tracking-abc.md` updated to show `startDate`/`endDate` filter params.

## Out of scope
- Paging UI using `nextToken` (a "Load more" button is acceptable).
- Reporting or summary insights across incidents.
- Bulk operations.
