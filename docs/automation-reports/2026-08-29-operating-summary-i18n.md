# Daily Report operatingSummary i18n (2026-08-29)

## Change
- Localize the Daily Report closeout `operatingSummary` for the exact
  `buildTodaySummary` English template (`Mise found N item(s) that may need
  attention before tomorrow.`) via `presentOperatingSummaryLabel`.
- EN / ES / zh-Hans catalog keys with one/other plural forms.
- Unknown or non-matching summary strings render as-is (no invented facts).

## Files
- `services/presentation/operatingSummaryLabel.ts`
- `app/more/daily-report.tsx`
- `i18n/catalog.ts`
- `tests/operatingSummaryLabel.test.ts`

## Verification
- `npm run typecheck`
- `node --import tsx --test tests/operatingSummaryLabel.test.ts tests/localization.test.ts`
- `npm test` (full suite)
- `npm run design:static`
- `npm run security:static`

## Non-goals
- Does not change domain `buildTodaySummary` output or invent new summary variants.
- Does not localize `learningNote` (not currently rendered).
- Orthogonal to open Create Task / miseStatus i18n stacks (#256).
