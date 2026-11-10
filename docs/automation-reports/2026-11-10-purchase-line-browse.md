# Purchase line browse UI (2026-11-10)

## Summary

MISE-004C already stores append-only purchase lines and exposes net-by-item and
history reads, but operators had no screen to review that ledger. Unmatched
credits (credits whose wording does not net against a purchase) were therefore
invisible in the app even though the RPC returned them.

## Changes

- More hub row → `/more/purchase-lines`
- Read-only screen loads `fetchPurchaseLineNetByItem`, `fetchPurchaseLineHistory`,
  and `fetchSuppliers` with restaurant-scoped hub fail-closed readiness
- Presentation helpers sort unmatched credits first and newest history first
- EN / ES / zh-Hans copy
- Route + layout smoke coverage for `/more/purchase-lines`

## Out of scope

- Ingestion / correction UI
- Order Mark Received per-line expiration (#670 / #1109 / #1111)
- ASCII-C inventing tips for free-form purchase-line display fields
- Changing purchase authority, recommendations, or supplier-send

## Verification

- `npm run typecheck`
- Focused `tests/purchaseLinesPresentation.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
