# Activity related-entity deep-links — 2026-08-31

## Problem

Expanded Activity rows printed `relatedEntityType` / `relatedEntityId` as
plain text. Operators could not jump into the inventory item, supplier order,
or restaurant task named by the event.

## Change

- Added `resolveActivityRelatedEntityHref` for
  `inventory_item` → `/inventory/{id}`,
  `supplier_order` → `/orders/{id}`,
  `restaurant_task` / `task` → `/tasks/{id}`.
- Unknown types, blank ids, and ids with `/ ? #` or whitespace fail closed.
- Activity hub shows a localized “Open related” control when a href resolves.
- EN / ES / zh-Hans catalog keys for the control and accessibility label.

## Paths

- `services/presentation/activityRelatedEntityPresentation.ts`
- `app/more/activity.tsx`
- `i18n/catalog.ts`
- `tests/activityRelatedEntityPresentation.test.ts`

## Verification

- `npm run typecheck`
- `npm test` (includes new presentation tests)

## Out of scope

- Deep-links for findings, recommendations, POS imports, memory, etc.
- Changing activity event persistence or domain writers
