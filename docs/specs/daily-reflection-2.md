# Daily Reflection: Partial Entries with Null Scores

## Summary
Fix the daily reflection form so that dimensions the parent never explicitly selects remain `null` rather than silently defaulting to the midpoint value (50 / "Balanced").

## User job
A parent wants to log only the dimensions they have meaningful information about — for example, only mood and sleep — without unintentionally recording "Balanced" for every untouched dimension.

## Required behaviors

### Score commitment model
- When a new reflection form opens, the UI shows the Balanced bucket visually pre-highlighted on each dimension as a guide, but no dimension is committed yet.
- The first time a parent taps any bucket on a dimension, that dimension becomes committed using the midpoint value for the tapped bucket (10, 30, 50, 70, or 90).
- Dimensions the parent never tapped are not committed and must be sent as `null` to the API.
- If the parent attempts to save with zero dimensions committed, show an inline validation message ("Select at least one dimension to save") and prevent submission.

### Loading existing reflections
- When loading a reflection that has `null` for a dimension, that dimension shows no bucket selected (the visual pre-highlight is absent, or Balanced is shown in a neutral/unselected visual state).
- When loading a reflection with a stored value, the matching bucket is shown as selected.

### API request
- The PUT body includes only committed dimensions (or explicitly sends `null` for previously stored values being cleared). Untouched dimensions on a new form are omitted from the request body.

## Acceptance criteria
- [ ] New form opens with Balanced visually suggested but no dimension committed.
- [ ] Tapping a bucket marks that dimension as committed.
- [ ] Untouched dimensions produce `null` in the PUT request (not `50`).
- [ ] Saving with zero committed dimensions shows an inline validation error.
- [ ] Existing reflections with `null` dimensions open without a bucket selected for those dimensions.
- [ ] Existing reflections with stored values show the correct bucket selected.

## Out of scope
- Changing bucket values, midpoints, or scoring ranges.
- Journal note handling.
- Trend chart or rolling-average calculations.
