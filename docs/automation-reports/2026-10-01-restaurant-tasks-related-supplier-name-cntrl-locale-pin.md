# MISE-005ET restaurant_tasks.related_supplier_name cntrl locale pin

Date: 2026-10-01
Branch: `cursor/mise-restaurant-tasks-related-supplier-name-cntrl-locale-pin`
Base: `origin/main` @ `78da737`

## Change

- Additive migration `20261001240000_mise_005et_restaurant_tasks_related_supplier_name_cntrl_locale_pin.sql`
- Reattach `restaurant_tasks_supplier_bound_check`
- Preserve exact `related_supplier_name is null or length(trim(related_supplier_name)) between 1 and 200`
- Add ASCII control rejection under COLLATE `"C"`:
  `related_supplier_name collate "C" !~ '[[:cntrl:]]'`
- Domain `optionalRelatedSupplierName` rejects the same ASCII C control set on create/read normalize paths

## Scope boundaries

CHECK-only SQL. Does not rewrite task RPCs, title (#556), detail (#554),
completion_result (#557), source_reference, client_task_id (#455), or sibling
free-text pins (#555/#553/#552/#551/#550).

## Verification

- `npm run typecheck`
- focused `restaurantTasksRelatedSupplierNameCntrlLocalePin`
- `npm test`
- pgTAP plan counted from assertion call sites in source
