# Inventory transfer reason evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-transfer-reason-evidence-main`

## Gap

`public.record_inventory_event` accepted any trimmed `p_reason_code` (including
null) for `event_type = 'transfer'`. The only production transfer write path
(PR #1100 `transfer_inventory`) stamps exactly `station_transfer`. A manager JWT
could therefore mint `transfer` + missing / `manual_move` / `Station_Transfer` /
`demo_transfer`, move on-hand under today's non-specialized projection (additive
`else` branch), raise operational Activity, and forge Activity / history reason
provenance.

## Change

- Domain: reject `transfer_requires_reason` / `invalid_transfer_reason` unless
  `reason_code` is exactly `station_transfer` (trim, no case fold).
- Additive BEFORE INSERT trigger
  `private.enforce_inventory_transfer_reason_evidence` with the same rule, plus
  a NOT VALID CHECK that skips legacy rows.
- Transport maps hosted `22023` messages ahead of the generic evidence matcher.
- pgTAP plan=8 from assertion call sites: missing/forged/case rejects, matching
  accept, non-transfer unconstrained, and direct-insert reject.

## Alone-OK

Orthogonal to transfer-source allowlist #1269 (accepts `transfer_inventory`
source; this tip only gates reason), storage-transfer productization #1100/#215
(stamps `station_transfer`; this guard accepts that label), waste/stockout/
correction/usage/adjustment reason tips, and purchase-line #1238/#1250–#1258.
Notes stay optional on the product writer. Contested merge: #1269 accept
fixtures that mint transfer with a null reason need `station_transfer` once both
land.

## Verification

- `npm run typecheck`
- focused transfer-reason suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run supabase:test` (may be unavailable without Docker in this environment)
