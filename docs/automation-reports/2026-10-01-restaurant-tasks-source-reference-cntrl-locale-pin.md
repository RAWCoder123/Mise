# MISE-005EU restaurant_tasks.source_reference cntrl locale pin

Date: 2026-10-01
Branch: `cursor/mise-restaurant-tasks-source-reference-cntrl-locale-pin`
Base: `origin/main` @ `78da737`

## Change

- Additive migration `20261001250000_mise_005eu_restaurant_tasks_source_reference_cntrl_locale_pin.sql`
- Reattach `restaurant_tasks_source_reference_bound_check`
- Preserve exact `source_reference is null or length(trim(source_reference)) between 1 and 240`
- Add ASCII control rejection under COLLATE `"C"`:
  `source_reference collate "C" !~ '[[:cntrl:]]'`
- Domain `optionalSourceReference` rejects the same ASCII C control set on create/read normalize paths

## Scope boundaries

CHECK-only SQL. Does not rewrite task RPCs, related_supplier_name (#558), title (#556),
detail (#554), completion_result (#557), client_task_id (#455), or sibling
free-text pins (#555/#553/#552/#551/#550).

## Verification

- `npm run typecheck`
- focused `restaurantTasksSourceReferenceCntrlLocalePin`
- `npm test`
- pgTAP plan counted from assertion call sites in source
