# Inventory reorder threshold <= par level (2026-09-03)

Branch tip for this automation run. Base: `origin/main` @ `20b28e5`.

## Gap

Inventory policy patches independently bounded `par_level` and `reorder_threshold`
to `0..1e6`. Operators (or partial patches) could set reorder above par, which
inverts health bands and poisons purchase / coverage signals. Schema and RPC
accepted the inverted pair.

## Fix

1. Migration `20260903210000_inventory_reorder_lte_par.sql` clamps existing
   inverted rows, adds `inventory_items_reorder_lte_par`, and rejects inverted
   merges inside `private.service_update_inventory_and_signals`.
2. Client `requireInventoryPolicyPair` / `requireInventoryItemPatch`, application
   merge check, Edge `requireInventoryPatch`, and demo repository parity.
3. Inventory detail UI + EN/ES/zh-Hans copy before save.
4. Greenfield `supabase/schema.sql` pin.

## Verification

- `npm run typecheck`
- focused `tests/inventoryReorderLtePar.test.ts` + related validation pins
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Notes

- Does not invent MOQ, lead time, or expiration.
- Avoids contested open stacks (#178–#379) and create-inventory (#226) migration.
- Hosted deploy of the additive migration remains an ops step.
