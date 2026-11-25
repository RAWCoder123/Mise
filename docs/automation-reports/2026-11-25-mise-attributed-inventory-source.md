# Fail closed forged Mise-attributed inventory sources

Date: 2026-11-25  
Baseline: `origin/main` @ `78da7376`

## Gap

Managers could call `record_inventory_event` with any `source` starting with
`mise`. Activity capture treated `source like 'mise%'` as `actor_type = mise`.
No production inventory writer stamps that prefix, so a manager JWT could move
on-hand while making Activity look system-authored.

## Change

- Domain rejects mise-prefixed sources (`forged_mise_attribution_source`)
- Additive BEFORE INSERT trigger rejects the same prefix when `auth.uid()` is
  present, covering RPC and outbox paths without breaking unauthenticated
  fixture seeds that historically used `mise-*` labels
- Activity capture now sets `actor_type` from `actor_user_id` presence, never
  from a client-controlled source prefix
- Transport maps the hosted `22023` message ahead of generic matchers
- pgTAP covers forged reject, case-insensitive reject, operator accept, actor
  type, and unauthenticated fixture seed allow

## Out of scope

- Count-session provenance (#388/#393)
- Supplier delivery receipt provenance (#1259)
- Purchase-line invents (#1238/#1250–#1258)
- Usage/adjustment reason allowlists (#396)

## Verification

- `npm run typecheck`
- Focused attribution + ledger + transport tests
- `npm test`
- `npm run security:static`
- `npm run security:backend`
