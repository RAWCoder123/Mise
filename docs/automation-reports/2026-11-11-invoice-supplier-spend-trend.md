# Invoice-grounded supplier spend trend (2026-11-11)

## Gap

Orders hub “Supplier spend” chart used only estimated sent-order cost
(`recommended_quantity × estimated_unit_cost`). MISE-004C already stores
factual `signed_extended_price` on `purchase_lines`, but that ledger never
reached the chart, so operators could trust a number that diverged from
invoices.

## Change

- Domain: `buildInvoiceSupplierSpendTrend` nets current purchase-line signed
  extended prices by transaction date; `resolveSupplierSpendTrend` prefers
  invoice evidence once ≥2 dated buckets exist, otherwise keeps the estimated
  series.
- Application: `fetchSupplierSpendTrend` also loads purchase lines and returns
  `{ basis, points }`.
- UI/i18n: Orders spend subtitle and accessibility copy distinguish invoice vs
  estimated basis (EN/ES/ZH). Legacy `orders.spend.subtitle` retained.

## Alone-OK

Complementary consumer of existing ledger reads. Does not overlap purchase-line
browse/write tips (#1238, #1250–#1254), valuation (#1248), pattern advisory
(#1249), or receive/FEFO stacks.

## Verification

See PR checks / local `npm run typecheck`, focused `supplierSpend` tests, and
static security/design gates.
