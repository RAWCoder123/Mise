# MISE-005BM: pos_integrations.sync_cursor cntrl locale pin

Date: 2026-09-28  
Branch: `cursor/mise-pos-integrations-sync-cursor-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.pos_integrations.sync_cursor` was unbound nullable text. Square sync
writers store it as `nullif(left(coalesce(p_sync_cursor, ''), 500), '')` with
no control-character rejection. Sibling POS identity columns were pinned under
COLLATE `"C"` by open MISE-005* tips; `sync_cursor` stayed unbound.

`sync_cursor` is the durable provider pagination token written after a
successful sales sync and cleared on disconnect. Under ctype drift, dump/restore
can disagree on the same cursor bytes — accepting a row a restored C-locale
gate would refuse (or the reverse), breaking POS incremental sync continuity.

## Fix

Additive migration
`20260928120000_mise_005bm_pos_integrations_sync_cursor_locale_pin.sql`
adds `pos_integrations_sync_cursor_check`:

```sql
sync_cursor is null
or (
  length(sync_cursor) between 1 and 500
  and sync_cursor collate "C" !~ '[[:cntrl:]]'
)
```

`length` (not `trim`) matches the writer `left(..., 500)` + `nullif('', '')`
contract.

## Out of scope

- Does not rewrite Square sync SECURITY DEFINER writers (still truncate only)
- Does not rewrite `external_location_id` (#466), merchant_id (#460), or
  pos_sales identities (#417/#472)
- Does not touch `selected_modifier_ids`, inventory_events, activity_events, or
  restaurant_memories

## Compose

Compose-safe alone on main. Timestamp after MISE-005BL (#472). Prefer landing
after nearby POS identity pins (#465/#466/#472) so restore continuity for POS
sync state is uniform; this tip does not depend on them.

## Verification

- `npm run typecheck`
- focused `tests/posIntegrationsSyncCursorLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here when Docker unavailable
