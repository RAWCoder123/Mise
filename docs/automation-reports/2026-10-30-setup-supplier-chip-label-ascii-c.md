# MISE-005UI setup supplier ChoiceChip label ASCII C (2026-10-30)

## Inventing proof

Setup inventory-step supplier ChoiceChips used Unicode `.trim()` on
`supplier.name` before rendering the chip label:

```ts
const label = supplier.name.trim() || t("setup.validation.supplierLabel", { count: String(index + 1) });
```

`'\u2003Fresh Farms\u2003'.trim()` invented clean `'Fresh Farms'` chrome.
Soft empty / Unicode-only space also collapsed into the intentional i18n
`supplierLabel` fallback through the same `.trim()`.

Open tip #904 / MISE-005RR explicitly left these chip labels alone.

## Change

- Add `services/domain/presentationSetupSupplierChipLabelIdentity.ts`
- Wire inventory-step supplier ChoiceChip labels in `app/(auth)/setup.tsx`
- Focused inventing proofs in `tests/presentationSetupSupplierChipLabelAsciiC.test.ts`

Soft-null Unicode padding / controls / non-string; intentional
`|| t("setup.validation.supplierLabel", …)` fallback preserved.

## Ownership

Owns setup inventory-step supplier ChoiceChip labels only. Does **not** own
durable setup `supplierNames` (#904), setup-screen supplier identity (#696),
setup supplier name/email saves (#680), setup inventory item names (#903),
inventory / recipe / ingredient validation labels, Create Task assignee chips
(#963), Login email chips (#971), or supplier draft line labels (#972).
