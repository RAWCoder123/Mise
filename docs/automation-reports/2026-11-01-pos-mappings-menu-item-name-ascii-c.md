# MISE-005VP POS mappings menu-item name ASCII C (2026-11-01)

## Defect

POS mapping review rendered suggested and selected menu-item names with
nullish coalescing before intentional localized fallbacks:

```ts
mapping.suggestedMenuItemName ?? t("common.none")
selectedMenuItem?.name ?? t("pos.mappings.chooseItem")
```

Unicode-only-space and empty string are non-nullish under `??`, bypassing
localized `common.none` / `pos.mappings.chooseItem` copy. Unicode `.trim()`
on padded menu-item names would invent clean display menu-item identities.

## Fix

- `services/domain/presentationPosMappingsMenuItemNameIdentity.ts`
- Soft-null via `normalizePosMappingsMenuItemName` (ASCII C single-line:
  ASCII end trim only; preserve NBSP — no fold; full C0/DEL reject) before
  `|| t("common.none")` and `|| t("pos.mappings.chooseItem")` on
  `app/settings/pos-mappings.tsx` (2 sites)

## Ownership

Owns only POS mappings suggestion `common.none` and choice-control
`pos.mappings.chooseItem` menu-item name presentation. Does **not** own
choice-list `menuItem.name` pass-through, Settings workspace cuisine_type
(#1023), Sales Import hero restaurant-name (#1022), Settings hub
restaurant-name (#1021), Orders gmail connected-body sender (#1020),
Settings/Gmail sender_email (#1019), waste itemName (#1018), Inventory
detail item_name (#1017), Orders detail supplier_name (#1016), or Home
ApprovalsSection card titles. Alone-OK relative to
#1023/#1022/#1021/#1020/#1019/#1018/#1017/#1016.

## Inventing / bypass proof

- `("\u2003" ?? FALLBACK) === "\u2003"` bypasses `?? t("common.none")` /
  `?? t("pos.mappings.chooseItem")`
- `("" ?? FALLBACK) === ""` same bypass
- `"\u2003Classic Burger\u2003".trim() === "Classic Burger"` inventing equality
- ASCII C soft-null restores the localized fallbacks

## Verification

- Focused `tests/posMappingsMenuItemNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
