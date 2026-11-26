# Purchase-line credits_line_id target evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-purchase-line-credit-link-target-evidence-main`

## Gap

`public.purchase_lines.credits_line_id` is set only when a source document names
the original invoice line. Hosted `append_purchase_line` already requires the
caller to be a credit and that the named id exists inside the same tenant and
`supplier_scope`. It does **not** require the named row to be a purchase.

On current main, every other insert path (direct `service_role` inserts that
satisfy the existing self/credit-type CHECKs and restaurant FK) can stamp
`credits_line_id` onto another credit, or onto a purchase that belongs to a
different supplier inside the same restaurant. Netting and unmatched-credit
findings then treat that forged link as durable document evidence.

Post-hoc manager attachments (#1257) live on a separate table and already
require `line_type = 'purchase'` plus matching `supplier_scope`. This tip
brings the immutable document-stated column up to the same target rules.

## Change

- Domain: `invalid_credit_link_target` via
  `purchaseLineCreditLinkTargetEvidence.ts`
- Additive BEFORE INSERT trigger
  `private.enforce_purchase_line_credit_link_target_evidence`
- Guard reconstructs `coalesce(supplier_id, nil UUID)` because generated
  `supplier_scope` is not yet available in BEFORE INSERT
- pgTAP plan=11 from assertion call sites (credit→credit and cross-supplier
  direct rejects; same-supplier purchase and unlinked accepts; RPC credit→credit
  reject plus same-supplier / unlinked accepts)

## Alone-OK

Orthogonal to purchase-line feature stack #1238/#1250–#1258 (including credit
attachments #1257), consistency-flags #1287, unpadded tips #1283–#1286,
inventory tips #1259–#1282, date-bounds, and ASCII-C / locale pins. Does not
rewrite `ingest_purchase_lines`, `append_purchase_line`, or the attachment
workflow. Does not weaken existing credit-type / self-link CHECKs or the
restaurant FK.

## Verification

- `npm run typecheck` — passed
- focused credit-link target evidence suite — 11/11 passed
- `npm test` — 687 passed / 0 fail / 7 cancelled (inherited withTimeout)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — not run in this environment
