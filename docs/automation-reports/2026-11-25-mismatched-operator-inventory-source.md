# Fail closed mismatched operator_* inventory sources

Date: 2026-11-25  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-operator-source-event-match-main`

## Gap

`public.record_inventory_event` accepted any trimmed `p_source`. Production
operator mutations always stamp `operator_${event_type}` via
`requireInventoryOperation`. A manager JWT could mint
`event_type = waste` with `source = operator_receipt` (or a case variant), move
on-hand, and present the wrong write-path provenance in Activity / history.

## Change

- Domain reject reason: `mismatched_operator_source`
- Additive BEFORE INSERT trigger
  `private.reject_mismatched_operator_inventory_source`
- Transport maps hosted `22023` message
  `Inventory operator source must match the operation`
- pgTAP plan derived from assertion call sites (plan = 8)

## Alone-OK

Orthogonal to #1259–#1263 (provenance / allowlist / mise / evidence / count-session)
and purchase-line #1238/#1250–#1258. Does not invent MOQ, lead time, or expiration.
