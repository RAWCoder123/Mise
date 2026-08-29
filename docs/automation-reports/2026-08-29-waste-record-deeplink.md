# Waste record deep-link (2026-08-29)

## Summary
More → Waste "Record waste" no longer dumps operators on the inventory hub
(defaulting to count). Operators pick an inventory item with uncapped ranked
search, then open inventory detail pre-selected on the waste ledger action.

## Changes
- `services/domain/inventoryOperatorAction.ts` — fail-closed query-param parse
- `services/domain/wasteRecordInventorySearch.ts` — ranked inventory find
- `app/inventory/[id].tsx` — honor `?operation=waste|receipt|count|stockout`
- `app/more/waste.tsx` — inline picker + deep-links for record and top items
- EN/ES/zh-Hans waste picker catalog keys
- Unit + wiring tests

## Verification
- `npm run typecheck`
- `npm test` (focused inventoryOperatorAction + wasteRecordInventorySearch; full suite)
- `npm run design:static`
- `npm run security:static`

## Notes
- Does not change staff waste permission (#214); detail still fail-closes view-only.
- Orthogonal to station attribution / receive putaway stacks.
- Invite-gated Auth signup remains deferred: hosted Auth `enable_signup=false`
  and invite-only admission tests intentionally block self-serve registration.
