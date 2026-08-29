# Restaurant Memory type/status i18n (2026-08-29)

Branch: `cursor/mise-restaurant-memory-type-status-i18n`
Base: `origin/main` @ `20b28e5`

## Problem

Restaurant Memory hub dumped raw `memoryType` enums via `replace(/_/g, " ")` and raw `status` enums (`active|confirmed|…`). ES/zh-Hans managers saw English snake-case labels instead of catalog copy.

## Fix

- `services/presentation/restaurantMemoryLabels.ts` — typed presenters for all `RestaurantMemoryType` / `RestaurantMemoryStatus` values; unknown → underscore-split fallback (never invents facts)
- Catalog EN/ES/zh-Hans `memory.type.*` and `memory.status.*`
- Wire `app/more/restaurant-memory.tsx`

## Tests

- typecheck
- `tests/restaurantMemoryLabels.test.ts`
- `npm test`
- design:static / security:static when available

## Notes

Orthogonal to open Daily Report / Create Task / Autonomy i18n stacks (#254–#260). Does not localize freeform `statement` or evidence summaries (operator/domain prose).
