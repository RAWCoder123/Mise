# Cash-only / non-itemized Square refund diagnostics (2026-09-03)

## Gap
Square sync ingested sale line items only. Cash-drawer or otherwise non-itemized
refunds (refund money present, no usable `returns[].return_line_items`) stayed
invisible while original sale rows continued to deplete inventory projections.
Itemized returns remain owned by open #357; this slice does not auto-reverse stock.

## Slice
- `classifyNonItemizedSquareRefund` / `searchSquareOrdersDetailed` detect refund
  money with zero usable return lines; `$0` comps stay silent
- Additive RPC stores bounded attention on `pos_integrations.settings` and
  `sales_imports.metadata` (service_role only)
- Sync + webhook record attention; sync response returns diagnostic counts
- Settings → POS surfaces durable warning (EN / ES / zh-Hans); demo sync seeds one
- No negative `pos_sales`, no inventory mutation from cash refunds

## Non-goals
- Auto inventory reverse for cash-only refunds
- Itemized Square returns (#357)
- POS depletion-skip browse UI (#359)
- MOQ / lead_time / expiration invention

## Proof
- Focused `tests/squareNonItemizedRefunds.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run security:static` / `security:backend` / `design:static` as applicable
