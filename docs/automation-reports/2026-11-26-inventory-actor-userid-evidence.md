# Inventory actor_user_id INSERT evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-inventory-actor-userid-evidence-main`

## Gap

`public.inventory_events.actor_user_id` was made nullable so account deletion
can anonymize only the actor while preserving append-only business fields.
Hosted `public.record_inventory_event` stamps `auth.uid()`, but any insert path
that reaches the table can still mint an unattributable ledger row with
`actor_user_id = null` and rewrite on-hand without operator attribution that
Activity / audit analysis can compare.

## Change

- Domain: reject `missing_actor_user_id` when accept authority lacks a
  non-empty actor id.
- Additive BEFORE INSERT trigger
  `private.enforce_inventory_actor_userid_evidence` with the same rule.
- Intentionally **no** NOT NULL CHECK — a CHECK would block the auth
  ON DELETE SET NULL anonymization UPDATE escape.
- Transport maps hosted `22023` messages ahead of the generic evidence matcher.
- pgTAP plan=8 from assertion call sites: null direct-insert reject, attributed
  direct insert accept, manager RPC accept + actor stamp, account-deletion
  anonymization still clears only `actor_user_id`.

## Alone-OK

Orthogonal to reason-code slug #1279, transfer location/quantity #1277/#1278,
reason/source allowlists #1259–#1276, other-reason notes #1275, evidence bounds
#1261, and purchase-line #1238/#1250–#1258. Does not rewrite
`reject_inventory_event_mutation`, restore table-level NOT NULL, or change
anonymization semantics.

## Verification

- `npm run typecheck` — passed
- focused actor-userid suite — 7/7 passed
- `npm test` — 683 passed / 0 fail / 7 cancelled (inherited)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — not run in this environment
