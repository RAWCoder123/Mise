# Fail closed forged approve_count_session inventory sources

Date: 2026-11-25  
Baseline: `origin/main` @ `78da7376`

## Gap

Managers could call `record_inventory_event` with `source = approve_count_session`
on any event type. The only production writer that stamps that label is
`private.service_approve_inventory_count_session` (service_role Edge path,
`auth.uid()` null). A manager JWT could therefore move on-hand while Activity
presented audited count-session provenance.

## Change

- Domain rejects `approve_count_session` on non-count events
  (`forged_approve_count_session_source`); demo/session count approval still
  accepts `count` + that source
- Additive BEFORE INSERT trigger rejects the label whenever `auth.uid()` is
  present, covering RPC and outbox paths without breaking service-role session
  approval or unauthenticated fixture seeds
- Transport maps the hosted `22023` message ahead of generic matchers
- pgTAP covers forged receipt/waste/count rejects, operator accept, and
  unauthenticated fixture seed allow

## Out of scope

- Count-session source authority requiring the label on counts (#388/#393)
- Supplier delivery receipt provenance (#1259)
- Mise-attributed source reject (#1260)
- Evidence field bounds (#1261)
- Purchase-line invents (#1238/#1250–#1258)

## Verification

- `npm run typecheck`
- Focused forge + ledger + transport tests
- `npm test`
- `npm run security:static`
- `npm run security:backend`
