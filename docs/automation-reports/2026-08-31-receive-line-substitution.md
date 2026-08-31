# Receive-line inventory substitution (2026-08-31)

## Gap
Hosted `record_supplier_delivery` already validated verified same-unit substitutes
and credited receipts onto the substitute item, but the client always sent
`substitutionInventoryItemId: null`. Operators could not attribute a swapped SKU
without corrupting the ordered item’s on-hand.

## Fix
- Domain: eligibility, fail-closed apply, receive preview, receipt target helper
- Application: `previewSupplierOrderDelivery` + `substitutionsByOrderedItemId` on receive
- Demo: credits substitute, marks discrepancy, persists `substitution_item_id`
- Hosted history select includes `substitution_item_id`; reliability treats it as discrepancy
- Order detail: per-line substitute chips (EN/ES/zh-Hans) before Mark received

## Verification
- `npm run typecheck` passed
- `tests/supplierDeliverySubstitution.test.ts` + `tests/supplierDeliverySubstitutionUi.test.ts` passed
- `npm test` — 638 pass / 0 fail (7 pre-existing recalculation cancellations)
- `npm run security:backend` / `security:static` (run in session)

## Notes
- No migration; hosted RPC already accepted substitutions
- Complements open discrepancy/receive stacks (#182/#197/#234/#286); does not add qty/damage/missing UI
- Does not invent substitutes; only verified same-canonical-unit items are offered
