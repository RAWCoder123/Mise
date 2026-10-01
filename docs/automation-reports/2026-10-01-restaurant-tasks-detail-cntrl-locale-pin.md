# MISE-005EP restaurant_tasks.detail cntrl locale pin

Date: 2026-10-01
Branch: `cursor/mise-restaurant-tasks-detail-cntrl-locale-pin`
Base: `origin/main` @ `78da737`

## Change

- Additive migration `20261001200000_mise_005ep_restaurant_tasks_detail_cntrl_locale_pin.sql`
- Reattach `restaurant_tasks_detail_check`
- Preserve exact `length(trim(detail)) between 1 and 2000` and nullability
- Add `detail collate "C" !~ '[[:cntrl:]]'`
- Domain `optionalTaskDetail` rejects the same ASCII C control set on create/read normalize paths

## Scope boundaries

CHECK-only SQL. Does not rewrite task RPCs, title, completion_result, or sibling free-text pins (#553/#552/#551/#550).

## Verification

- `npm run typecheck`
- focused `restaurantTasksDetailCntrlLocalePin`
- `npm test`
- pgTAP plan counted from assertion call sites in source
