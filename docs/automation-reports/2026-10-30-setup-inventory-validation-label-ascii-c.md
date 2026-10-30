# MISE-005UJ setup inventory validation label ASCII C (2026-10-30)

## Inventing proof

Setup inventory validation used Unicode `.trim()` on `item.name` before
embedding it in needsName / needsQuantity / needsUnit / supplier / range
messages:

```ts
const label = item.name.trim() || t("setup.validation.inventoryLabel", { count: formatNumber(index + 1) });
```

`'\u2003Roma Tomatoes\u2003'.trim()` invented clean `'Roma Tomatoes'` chrome.
Soft empty / Unicode-only space also collapsed into the intentional i18n
`inventoryLabel` fallback through the same `.trim()`.

Open tip #973 / MISE-005UI explicitly left these inventory validation labels alone.

## Change

- Add `services/domain/presentationSetupInventoryValidationLabelIdentity.ts`
- Wire inventory validation labels in `app/(auth)/setup.tsx`
- Focused inventing proofs in `tests/presentationSetupInventoryValidationLabelAsciiC.test.ts`

Soft-null Unicode padding / controls / non-string; intentional
`|| t("setup.validation.inventoryLabel", …)` fallback preserved.

## Ownership

Owns setup inventory validation labels only. Does **not** own setup supplier
ChoiceChip labels (#973), durable setup `supplierNames` (#904), setup-screen
supplier identity (#696), setup supplier name/email saves (#680), setup
inventory item names (#903), recipe / ingredient validation labels, Create Task
assignee chips (#963), Login email chips (#971), or supplier draft line labels
(#972).
