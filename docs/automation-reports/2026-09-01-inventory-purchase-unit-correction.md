# Inventory purchase-unit correction (2026-09-01)

## Gap
Managers could not correct `inventory_items.unit` after setup/create. Wrong purchase
labels permanently poisoned counts, pars, recommendations, and recipe compatibility.
`safe_patch` / Edge allowlists only permitted `par_level` and `reorder_threshold`.

## Change
- Additive migration expands `private.service_update_inventory_and_signals` to accept
  bounded `unit` (1–40 chars, trimmed). Still rejects `current_quantity` and
  `supplier_name`. Unit updates rely on the existing before-update canonical
  normalization trigger.
- Edge `requireInventoryPatch` allowlists `unit` with `requireBoundedString(..., 40)`.
- Client `InventoryItemPatch` + validation normalize purchase unit; demo repository
  re-infers canonical conversion on unit change for hosted parity.
- Inventory detail exposes editable Purchase unit with EN/ES/zh-Hans copy and a
  recount/verification hint.

## Verification
- `npm run typecheck`
- Focused: `tests/inventoryPurchaseUnitCorrection.test.ts`,
  `tests/serviceInventoryPolicyOnlyPatches.test.ts`, patch assertions in
  `tests/security.test.ts` / `tests/miseDomain.test.ts`
- `npm test`

## Residual
- Hosted migration deploy still required for production tenants.
- Pack/unknown units still need manager canonical verification after correction.
- Recipe mappings that used the old unit remain incompatible until repaired (#297).
