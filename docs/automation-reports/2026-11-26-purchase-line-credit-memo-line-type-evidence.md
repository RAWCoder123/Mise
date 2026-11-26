# Purchase-line credit_memo line_type evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-purchase-line-credit-memo-line-type-evidence-main`

## Gap

`public.purchase_lines.source = 'credit_memo'` names a credit-memo document.
Hosted `ingest_purchase_lines` allowlists that source and
`append_purchase_line` independently requires a stated purchase/credit
direction. Neither couples the two.

On current main, every insert path (including direct `service_role` inserts
that satisfy the existing source and line_type CHECKs) can stamp
`source = 'credit_memo'` with `line_type = 'purchase'`. That forges a purchase
into a credit-memo document's idempotency space and makes signed quantity/price
positive while claiming durable document evidence came from a credit memo.
Netting, unmatched-credit findings, and spend summaries then treat that forged
purchase as ordinary spend from a credit-memo document.

Invoice, order_confirmation, and manual_entry documents may still carry credit
lines. This tip only requires the one-way coupling: `credit_memo => credit`.

## Change

- Domain: `invalid_credit_memo_line_type` via
  `purchaseLineCreditMemoLineTypeEvidence.ts`
- Additive BEFORE INSERT trigger
  `private.enforce_purchase_line_credit_memo_line_type_evidence`
- NOT VALID CHECK `purchase_lines_credit_memo_line_type_check`
- pgTAP plan=10 from assertion call sites (direct credit_memo+purchase reject;
  credit_memo+credit accept; invoice+credit and invoice+purchase still accept;
  RPC credit_memo+purchase reject; RPC credit_memo+credit and invoice+credit
  accept)

## Alone-OK

Orthogonal to purchase-line feature stack #1238/#1250–#1258, credit-link target
#1288, consistency-flags #1287, unpadded tips #1283–#1286, inventory tips
#1259–#1282, date-bounds, and ASCII-C / locale pins (#524/#526). Does not
rewrite `ingest_purchase_lines`, `append_purchase_line`, or
`supersede_purchase_line`. Does not weaken existing source / line_type
allowlists.

## Verification

- `npm run typecheck` — passed
- focused credit-memo line-type evidence suite — 7/7 passed
- `npm test` — 690 passed / 0 fail / 0 cancelled
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — not run in this environment
