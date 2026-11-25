# Unsupported inventory stockout source allowlist (2026-11-25)

## Gap

`public.record_inventory_event` accepted any trimmed `p_source` (1–80 chars).
Production stockout mutations only stamp `operator_stockout` via
`requireInventoryOperation`. An authenticated owner/admin/manager could append
stockout with an arbitrary source (`manual`, `receiving`, `demo_stockout`, case
variants), zero on-hand, raise inventory-risk Activity, and forge Activity /
history write-path provenance.

## Change

- Domain rejects `unsupported_stockout_source` unless source is exactly
  `operator_stockout` (trimmed, no case folding).
- Additive BEFORE INSERT trigger
  `private.reject_unsupported_inventory_stockout_source` enforces the same rule on
  every write path.
- Transport maps the hosted `22023` message containing `stockout source` ahead of
  generic matchers so outbox settles as a terminal reason.
- pgTAP plan=8 derived from assertion call sites.

## Alone-OK

Orthogonal to waste-source allowlisting (#1265), receipt-source allowlisting
(#1263), mismatched `operator_*` (#1264), forged `approve_count_session` (#1262),
evidence bounds (#1261), mise attribution (#1260), supplier_delivery provenance
(#1259), reject no-op stockout (#1240), and the purchase-line stack
(#1238/#1250–#1258). Demo seed `demo_stockout` rows (if any) stay in the
in-memory demo repository and never hit hosted `inventory_events`.

## Verification

- `npm run typecheck`
- focused stockout-source + ledger + transport tests
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
