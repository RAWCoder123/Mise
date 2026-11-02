# MISE-005WQ: Orders review recommendation supplier_name ASCII C

Date: 2026-11-02  
Branch: `cursor/mise-orders-review-supplier-name-ascii-c`  
Base: `origin/main` @ `78da7376`

## Defect

Orders hub review queue always passed raw `recommendation.supplier_name` (via
grouped `supplierName`) into:

- the drafts-lane pending card title when exactly one supplier group exists; and
- the review-lane supplier header Text.

Empty / Unicode-only-space names rendered blank-looking supplier identity on the
Orders review queue. Unicode `.trim()` on padded names would invent a clean
supplier label.

## Fix

- `services/domain/presentationOrdersReviewSupplierNameIdentity.ts` —
  ASCII C single-line end trim; preserve NBSP; full C0/DEL reject; soft-null
- `app/(tabs)/orders.tsx` — route pending title and review supplier header
  through `normalizeOrdersReviewSupplierName`
- `i18n/catalog.ts` — `orders.review.supplierName.none` in EN / ES / zh-Hans
- Focused inventing + bypass proofs in
  `tests/ordersReviewSupplierNameAsciiC.test.ts`

## Alone-OK

Leaves SupplierDraftCard order.supplier_name (#1050), Orders detail title
supplier_name (#1016), miseDomain draft-order supplier_name (#1034),
orderPresentation line labels (#887), supplier draft line labels (#972),
Home ApprovalsSection card.title (#1049), and `orders.notice.copied`
order.supplier_name interpolations alone.

## Verification

- focused tip tests
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`
