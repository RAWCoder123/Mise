# Inventory transfer quantity_moved evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-transfer-quantity-moved-evidence-main`

## Gap

`public.record_inventory_event` accepted any `p_metadata` (including `{}`) for
`event_type = 'transfer'`. The only production transfer write path
(PR #1100 `transfer_inventory`) stamps positive
`metadata.quantity_moved`. A manager JWT could therefore mint `transfer` with
missing / zero / negative / string `quantity_moved`, move on-hand under today's
non-specialized projection (additive `else` branch), raise operational Activity,
and forge Activity / history movable-amount provenance.

## Change

- Domain: reject `transfer_requires_quantity_moved` unless metadata carries a
  finite number `quantity_moved` strictly greater than zero.
- Additive BEFORE INSERT trigger
  `private.enforce_inventory_transfer_quantity_moved_evidence` with the same
  rule, plus a NOT VALID CHECK that skips legacy rows.
- Transport maps hosted `22023` messages ahead of the generic quantity matcher.
- pgTAP plan=9 from assertion call sites: missing/zero/negative/non-number
  rejects, matching accept, non-transfer unconstrained, and direct-insert
  reject.

## Alone-OK

Orthogonal to transfer-location #1277 (distinct from/to UUID ids; this tip only
gates `quantity_moved`), transfer-source allowlist #1269, transfer-reason
#1276, storage-transfer productization #1100/#215 (stamps the same
`quantity_moved` key; this guard accepts that shape without creating
`storage_locations` or forcing ledger `quantity = 0`), waste/stockout/correction
reason tips, and purchase-line #1238/#1250–#1258.

Does **not** require ledger `quantity = 0` (leave-alone #1119/#374). Contested
merge: #1276 / #1269 accept fixtures that mint transfer with `metadata: {}`
need a positive numeric `quantity_moved` once this tip lands. #1277's accept
fixture already includes `quantity_moved: 2`.

## Verification

- `npm run typecheck` — passed
- focused transfer-quantity-moved suite — 9/9 passed
- `npm test` — 685 passed / 0 fail / 7 cancelled (inherited)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — not run in this environment
