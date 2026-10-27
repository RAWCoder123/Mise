# MISE-005RQ setup inventory item name ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-setup-inventory-item-name-ascii-c`

## Problem

`app/(auth)/setup.tsx` fed inventory `name` into `item.name.trim()` emptiness /
label gates and into `inventoryItemNames` → `continueWithDemo` /
`normalizeInventoryDraftNumbers` → hosted `saveRestaurantSetup`. Unicode trim
invents a clean inventory item name (`'\u2003Tomato\u2003'.trim() === 'Tomato'`).
Unicode-only space also invents the required-empty branch via
`'\u2003'.trim() === ''`.

Open #679 / MISE-005JJ pins application inventory-name **keys** /
`asciiCTrim(draft.name)` and does not own this screen validate / demo list
path. Tip them separately.

## Change

- New `services/domain/setupInventoryItemNameIdentity.ts` (MISE-005RQ)
- Soft empty / Unicode-only space → `empty` (required name; blank normalize)
- ASCII whitespace still trims clean before labels / normalize / demo names
- Unicode-padded / control → `invalid` (`needsName`; no invent)
- Wire setup inventory validate + normalize + demo `inventoryItemNames`
  through `prepareSetupInventoryItemNameText`
- Leave hasDraftData emptiness on bare `item.name.trim()`
- Leave setup inventory quantity to open #895 / MISE-005RI
- Leave setup inventory parLevel to open #894 / MISE-005RH
- Leave setup inventory unit emptiness gate on bare `.trim()`
- Leave application `draft.name.trim()` to open #679 / MISE-005JJ
- Leave setup.tsx `supplierNames` Unicode trim alone

## Landing notes

Alone-OK with #902 / #901 / #900 / #899 / #898 / #897 / #896 / #895 / #894 /
#862 / #861 / #679. Keep `setupInventoryItemNameIdentity.ts` separate from
`setupInventoryQuantityIdentity.ts` (#895),
`setupInventoryParLevelIdentity.ts` (#894),
`setupInventoryUnitIdentity.ts` (#861), and #679's inlined
`normalizeSetupInventoryItemKey` / `asciiCTrim`. When landing with #895, drop
that tip's assertion that setup still uses bare
`item.name.trim()` for label / needsName once this tip owns those paths
(hasDraftData may still match). When landing with #679, drop this tip's
assertion that application still uses `const itemName = draft.name.trim();`
once #679 owns `asciiCTrim(draft.name)`.

## Verification

- focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` on main; tip +4 vs main ~683)
- Docker pgTAP unavailable in this environment
