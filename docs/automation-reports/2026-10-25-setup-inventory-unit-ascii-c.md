# MISE-005QA: pin setup inventory units to ASCII C

Date: 2026-10-25  
Branch: `cursor/mise-setup-inventory-unit-ascii-c`

## Inventing proof

`saveRestaurantSetup` stored inventory draft and recipe-ingredient units via
Unicode `.trim()` with a soft `"unit"` default:

```ts
const unit = draft.unit.trim() || "unit";
const unit = ingredient.unit.trim() || "unit";
```

NBSP / em-space padding invented a clean durable unit before persistence
(`'\u2003lb\u2003'.trim() || "unit" === 'lb'`). Soft-empty Unicode-only
padding also collapsed into the intentional `"unit"` default.

Open tips that own related surfaces do not cover this operator boundary:

- #586 / MISE-005FV — `inventory_items.unit` SQL cntrl CHECK
- #669 / MISE-005JA — `inventoryUnits` client fold helpers
- #709 / MISE-005KN — `operationalMapping` unit identity
- #679 / MISE-005JJ — setup inventory-name keys
- #843 / MISE-005PI — setup attachment labels
- #742 / MISE-005LL — setup restaurant workspace
- #769 / MISE-005MM — setup referenceId

## Change

- Add `services/domain/setupInventoryUnitIdentity.ts` with ASCII-only end trim
  and fail-closed canonicalize (MISE-005QA).
- Route both `draft.unit` and `ingredient.unit` through
  `normalizeCanonicalSetupInventoryUnit(...) ?? SETUP_INVENTORY_UNIT_DEFAULT`.
- Soft empty (ASCII or Unicode-only space) still falls through to `"unit"`.
- Unicode-padded non-empty tokens fail closed with
  `Setup inventory unit is invalid.`
- Leave draft name, dishName, ingredient name, attachment label, restaurantId,
  supplier emptiness, and referenceId trims alone.

## Verification

- focused AsciiC: 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK relative to #586 / #669 / #709 / #679 / #843 / #742 / #769 (separate
modules). When landing with #679, keep `setupInventoryUnitIdentity` separate
from inventory-name key helpers and drop any mutual assertions that the other
field still Unicode-trims once that tip owns it.
