# Secondary hub fail-closed + count-session plan refs

## Summary

Continued from tip `cursor/mise-product-inspection-e90c` (@ `b30b86f`) on branch `cursor/mise-product-inspection-d761`.

Primary restaurant hubs already used `hubLoadState` / `actionsEditable`. Secondary mutation screens still allowed role-gated actions after soft-refresh load errors while stale rows remained visible. Count-session Today tasks also lacked operating-plan related refs, so phase briefs fell through to `/today`.

## Changes

1. Fail-close mutations on:
   - `app/settings/autonomy.tsx`
   - `app/more/restaurant-memory.tsx`
   - `app/more/log-delivery.tsx`
   - `app/settings/pos.tsx`
   - `app/more/create-task.tsx`
   - Settings account deletion open/confirm in `app/(tabs)/settings.tsx`
2. Operating-plan related entity type `inventory_count_session` + `relatedRefsForTask` wiring.
3. Daily phase brief route union includes `/inventory/count` for count-session urgency.

## Verification

- `npm run typecheck`
- `npm test` — 490 pass / 0 fail (7 pre-existing recalculation timeout cancels)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

## Classification

Controlled pilot-ready code tip. Not App Store submission-ready.

## Next

1. Batch receive with discrepancy editing (as-ordered-only UI remains).
2. Recipe unlink + restore Today unmapped-POS repair.
3. Hosted/Docker security re-proof when credentials/Docker available.
