# Unmatched invoice-credit operational findings

Date: 2026-11-25  
Baseline: `origin/main` @ `78da7376`

## Gap

MISE-004C returns `unmatched_credit` on purchase-line nets when a credit memo’s
normalized item key matches no purchase under the same supplier, unit, and
currency. That flag existed only on the RPC / demo ledger path. Operators never
saw it on Home, Daily Brief, or findings, so unnetted invoice spend stayed
invisible.

## Change

- Domain `buildDailyOperationalBrief` accepts optional restaurant-scoped
  `purchaseLineNets` and emits one Up-next `cost` finding when any net has
  `unmatchedCredit: true`.
- Evidence is bounded (`data_gap`, max 5 rows), deterministic, and never
  invents a fuzzy match.
- Application `findings` and `operatingBrief` load
  `fetchPurchaseLineNetByItem`. A failed read omits the input (unknown) rather
  than claiming there are no unmatched credits.

## Out of scope

- Purchase-line browse UI (#1238)
- Credit attach / alias / correction / inventory link stacks (#1250–#1257)
- Activity recovery CTAs (sequenced after browse + correction)
- FEFO / receipt expiration (#1237)

## Verification

- `npm run typecheck`
- Focused `tests/operationalFindings.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
