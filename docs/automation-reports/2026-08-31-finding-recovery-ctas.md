# Daily Brief finding recovery CTAs (2026-08-31)

## Summary

Daily Brief findings previously showed raw missing-data codes and only
approve/edit/dismiss feedback. Operators could see that a count, unit, recipe
mapping, or sales import was missing, but the card did not route them to the
existing recovery surface.

This change adds presentation-only recovery CTAs on `DailyBriefBoard` (shared by
Today and Insights) and localizes missing-data labels for EN, ES, and zh-Hans.

## Behavior

- `presentFindingRecoveryActions` maps `freshness.missingData`, typed
  `evidence`, and `affectedWorkflow` to existing routes:
  - verified count → `/inventory/count`
  - verified unit → `/inventory/{id}` when inventory evidence exists
  - recipe / menu mapping → `/settings/recipes`
  - today’s sales → `/settings/sales-import`
  - empty inventory setup → `/setup`
  - purchase recommendation evidence → `/orders`
  - inventory item evidence → `/inventory/{id}`
- At most three unique hrefs are shown; no mutations are performed.
- Missing-data codes are localized (`Verified count`, named recipe mappings,
  etc.). Unknown codes remain visible as raw tokens.
- Feedback approve/edit/dismiss behavior is unchanged.

## Files

- `services/presentation/findingRecoveryPresentation.ts`
- `components/dailyBrief/DailyBriefBoard.tsx`
- `i18n/catalog.ts`
- `tests/findingRecoveryPresentation.test.ts`
- `tests/dailyBriefAndExportUi.test.ts`
- `docs/automation-reports/2026-08-31-finding-recovery-ctas.md`

## Verification

- `npm run typecheck` — passed
- `npm test` — 637 passed, 0 failed, 7 cancelled
- `npm run security:static` — passed
- No migrations

## Classification impact

Controlled pilot-ready code. Improves operator recovery on the Daily Brief
without changing authority, inventory, or purchasing backends.
