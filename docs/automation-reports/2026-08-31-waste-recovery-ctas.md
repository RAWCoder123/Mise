# Waste recovery CTAs + account deletion session fail-closed

Date: 2026-08-31
Branch: `cursor/mise-waste-recovery-ctas`
Base: `origin/main` @ `20b28e5`

## Problem

1. Waste analysis already computed `recommendedAction` (`start_logging`,
   `review_repeat_item`, `complete_cost_setup`, `keep_logging`), but the Waste
   hub always showed “Record waste” and routed to `/inventory`.
2. After a successful Edge account deletion, Settings called `signOut()`, which
   awaited remote Auth revoke before clearing local state. With the Auth user
   already gone, that throw surfaced as a false deletion failure and left a
   stale local session.

## Changes

- `services/presentation/wasteRecoveryPresentation.ts` — maps recommended
  action → label + existing route; item actions fail closed to `/inventory`
  when `primaryItemId` is absent.
- `app/more/waste.tsx` — primary CTA follows the presenter.
- `i18n/catalog.ts` — EN/ES/zh-Hans action labels.
- `contexts/MiseSessionContext.tsx` — `signOut` always clears local state;
  `clearSessionAfterAccountDeletion` uses local-scope revoke + clear.
- `app/(tabs)/settings.tsx` — post-delete uses the new clearer; never reports
  delete failure solely because remote signOut failed after Auth deletion.

## Verification

- `npm run typecheck`
- `npm test` (targeted + full suite)
- No migrations

## Notes

Does not change waste ledger authority, inventory mutations, or the Edge
deletion RPC. Complements open stacks #231/#262/#301/#306 without depending on
them.
