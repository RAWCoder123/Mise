# Service inventory policy-only patches (2026-08-10)

Branch: `cursor/mise-product-inspection-5749`  
Base tip: `cursor/mise-product-inspection-824d` @ `0d873f3`

## Gap

Operator counts already use the append-only `record_inventory_event` ledger (device outbox → RPC → projection). Edge and client validation already reject `current_quantity` on `update_inventory`. The service-role SQL helper `private.service_update_inventory_and_signals` still accepted and wrote `current_quantity` directly, creating a ledger bypass for anyone holding the service role.

## Fix

1. Migration `20260810130000_service_inventory_policy_only_patches.sql` limits service patches to `par_level`, `reorder_threshold`, and `supplier_name`.
2. pgTAP tenant isolation now asserts quantity patches are rejected and policy patches leave on-hand unchanged.
3. Demo `updateInventoryItemAndSignals` rejects `current_quantity` for parity.
4. Unit pins in `tests/security.test.ts` and `tests/serviceInventoryPolicyOnlyPatches.test.ts`.

## Next

- Hosted/Docker security re-proof after tip drift.
- Founder Auth redirect allowlist + privacy/support/terms HTTPS URLs.
- Multi-item count sessions remain on older inspection branches; evaluate port only if operator workflow needs it beyond single-item ledger counts.
