# MISE-005UM setup inventory supplier-required error label ASCII C

Date: 2026-10-30

## Inventing proof

`services/application/setup.ts` `validateSetupInput` used Unicode `.trim()` on
`item.name` before embedding it in the supplier-required Error:

```text
${item.name.trim() || "Inventory item"} requires a configured supplier.
```

`'\u2003Roma Tomatoes\u2003'.trim()` invented clean `'Roma Tomatoes'`. Soft empty
/ Unicode-only space collapsed into the intentional English `"Inventory item"`
fallback.

Open #974 owns setup-screen inventory validation i18n labels and left this
application error path alone. Open #679 owns durable `draft.name.trim()` /
inventory-name keys and still leaves this validate error on Unicode trim.
Open #903 owns setup-screen durable inventory item-name gates and left
application `draft.name.trim()` alone.

## Change

- Add `services/domain/presentationSetupInventorySupplierRequiredLabelIdentity.ts`
  with ASCII end trim; soft-null Unicode padding / controls / non-string.
- Route `validateSetupInput` supplier-required error labels through
  `presentationSetupInventorySupplierRequiredLabel`; preserve
  `|| "Inventory item"` fallback.
- Leave `hasDraftData` emptiness, quantity/par labels, and durable
  `draft.name.trim()` save path alone.

## Ownership

Owns setup inventory supplier-required error labels only. Does **not** own
setup-screen inventory validation labels (#974), durable setup inventory item
names (#903), setup inventory-name keys (#679), recipe / ingredient validation
labels (#975 / #976), setup supplier ChoiceChip labels (#973), or durable
supplierNames (#904).
