# Unsupported inventory adjustment source allowlist

Date: 2026-11-25  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-adjustment-source-allowlist-main`

## Gap

`public.record_inventory_event` accepted any trimmed `p_source` for
`event_type = 'adjustment'`. Production manager adjustments (PR #348
`requireInventoryAdjustment`) stamp exactly `operator_adjustment`. A manager
JWT could therefore mint `adjustment` + `manual` / `demo_adjustment` /
`Operator_Adjustment`, move on-hand with a signed delta, raise operational
Activity, and forge Activity / history write-path provenance.

## Change

- Domain: reject `unsupported_adjustment_source` unless source is exactly
  `operator_adjustment` (trim, no case fold).
- Additive BEFORE INSERT trigger
  `private.reject_unsupported_inventory_adjustment_source` with the same rule.
- Transport maps hosted `22023` message containing `adjustment source` to
  `unsupported_adjustment_source` ahead of generic matchers.
- pgTAP plan=8 from assertion call sites: forged/manual/case/demo rejects,
  matching accept, non-adjustment unconstrained, direct-insert reject.

## Alone-OK

Orthogonal to #1259–#1267 (other event-type source allowlists), usage UI #365,
adjustment UI #348, usage/adjustment evidence #396, and purchase-line
#1238/#1250–#1258. Demo `demo_adjustment` (if any) stays in-memory only.

## Verification

- `npm run typecheck` — passed
- focused adjustment-source suite — 5/5 passed
- `npm test` — 681 passed / 0 fail / 7 cancelled (inherited)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — not run in this environment
