# Unsupported inventory transfer source allowlist

Date: 2026-11-25  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-transfer-source-allowlist-main`

## Gap

`public.record_inventory_event` accepted any trimmed `p_source` for
`event_type = 'transfer'`. The only production transfer write path (PR #1100
`transfer_inventory`) stamps exactly `transfer_inventory`. A manager JWT could
therefore mint `transfer` + `manual` / `demo_transfer` / `Transfer_Inventory` /
`operator_transfer`, move on-hand under today's non-specialized projection,
raise operational Activity, and forge Activity / history write-path provenance.

## Change

- Domain: reject `unsupported_transfer_source` unless source is exactly
  `transfer_inventory` (trim, no case fold).
- Additive BEFORE INSERT trigger
  `private.reject_unsupported_inventory_transfer_source` with the same rule.
- Transport maps hosted `22023` message containing `transfer source` to
  `unsupported_transfer_source` ahead of generic matchers.
- pgTAP plan=8 from assertion call sites: forged/manual/case/demo rejects,
  matching accept, non-transfer unconstrained, direct-insert reject.

## Alone-OK

Orthogonal to #1259–#1268 (other event-type source allowlists and operator_*
match), storage-transfer productization #1100/#215 (stamps `transfer_inventory`;
this guard accepts that label), #394/#395 correction drafts, and purchase-line
#1238/#1250–#1258. Demo `demo_transfer` (if any) stays in-memory only.

## Verification

- `npm run typecheck` — passed
- focused transfer-source suite — 5/5 passed
- `npm test` — 681 passed / 0 fail / 7 cancelled (inherited)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — not run in this environment
