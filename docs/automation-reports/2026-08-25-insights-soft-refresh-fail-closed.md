# Insights soft-refresh fail-closed (false empty / learning claims)

Date: 2026-08-25  
Branch: `cursor/mise-insights-soft-refresh-fail-closed`  
Baseline: `origin/main` @ `6eedbfb`

## Gap

Soft-refresh load failures on Insights already set `hubLoadState` to `error` and
cleared restaurant-scoped `visible*` arrays via `hubReady`. The UI still rendered:

- manager summary copy claiming Mise is waiting for / learning signals
- Daily Brief empty-calm copy
- manager brief "still learning" empty state
- sales trend / analytics empty copy claiming no recorded sales

That falsely presented an unavailable hub as calm or empty learning.

## Fix

- Derive `hubUnavailable` from shared hub load state.
- Capture load failures with `captureMiseError`.
- When unavailable: use unavailable summary/next-step copy, hide Daily Brief /
  severity filters / empty-learning brief / memory board, and pass
  `unavailable` into sales trend + analytics so they do not claim missing sales.
- Add EN / ES / zh-Hans catalog keys for unavailable surfaces.

## Paths

- `app/(tabs)/insights.tsx`
- `i18n/catalog.ts`
- `tests/pilotUiSafety.test.ts`
- `tests/clientTenantSafety.test.ts`

## Verification

- `npm run typecheck`
- targeted node tests for pilot UI safety + client tenant safety + hub load state

## Do not redo

- Overlap with Orders Gmail unavailable (#166), Settings/POS/Gmail soft-refresh
  (#163–#165), hub draft-preserve (#155–#162), readiness gates (#145/#148/#149).
