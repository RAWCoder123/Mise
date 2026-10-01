# MISE-005ER restaurant_tasks.title cntrl locale pin

Date: 2026-10-01
Branch: `cursor/mise-restaurant-tasks-title-cntrl-locale-pin`
Base: `origin/main` @ `78da737`

## Change

- Additive migration `20261001220000_mise_005er_restaurant_tasks_title_cntrl_locale_pin.sql`
- Reattach `restaurant_tasks_title_check`
- Preserve exact `length(trim(title)) between 1 and 160`
- Add ASCII control rejection under COLLATE `"C"`:
  `title collate "C" !~ '[[:cntrl:]]'`
- Domain `requiredTaskTitle` rejects the same ASCII C control set on create/read normalize paths

## Scope boundaries

CHECK-only SQL. Does not rewrite task RPCs, detail (#554), completion_result,
client_task_id (#455), or sibling free-text pins (#555/#553/#552/#551/#550).

## Verification

- `npm run typecheck`
- focused `restaurantTasksTitleCntrlLocalePin`
- `npm test`
- pgTAP plan counted from assertion call sites in source
