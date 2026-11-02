# MISE-005WP: SupplierDraftCard supplier_name ASCII C

Date: 2026-11-02  
Branch: `cursor/mise-supplier-draft-card-supplier-name-ascii-c`  
Base: `origin/main` @ `78da7376`

## Defect

Orders hub `SupplierDraftCard` always passed raw `order.supplier_name` into the
supplierName Text and accessibility interpolations. Empty / Unicode-only-space
names rendered blank-looking supplier identity on draft/sent/received cards.
Unicode `.trim()` on padded names would invent a clean supplier label.

## Fix

- `services/domain/presentationSupplierDraftCardSupplierNameIdentity.ts` —
  ASCII C single-line end trim; preserve NBSP; full C0/DEL reject; soft-null
- `components/SupplierDraftCard.tsx` — route supplier chrome and a11y
  interpolations through `normalizeSupplierDraftCardSupplierName`
- `i18n/catalog.ts` — `orders.card.supplier.none` in EN / ES / zh-Hans
- Focused inventing + bypass proofs in
  `tests/supplierDraftCardSupplierNameAsciiC.test.ts`

## Alone-OK

Leaves Orders detail title supplier_name (#1016), miseDomain draft-order
supplier_name (#1034), orderPresentation line labels (#887), supplier draft
line labels (#972), Home ApprovalsSection card.title (#1049), and line
`itemName` pass-through alone.

## Verification

- focused tip tests
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`
