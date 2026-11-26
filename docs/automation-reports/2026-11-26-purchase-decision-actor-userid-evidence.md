# Purchase-decision actor_user_id INSERT evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-purchase-decision-actor-userid-evidence-main`

## Gap

`public.purchase_decision_events.actor_user_id` is nullable so account deletion
can anonymize only the actor while preserving append-only business fields.
Hosted `private.record_purchase_decision_base_event` and
`private.record_purchase_decision_compensation` stamp `auth.uid()`, but any
insert path that reaches the table can still mint an unattributable approve,
dismiss, undo, or exclusion row with `actor_user_id = null` — learning evidence
pattern aggregation / Activity / audit analysis cannot pin to an operator.

## Change

- Domain: `validatePurchaseDecisionActorUserIdEvidence` rejects
  `missing_actor_user_id` when the actor id is null, undefined, or blank.
- Additive BEFORE INSERT trigger
  `private.enforce_purchase_decision_actor_userid_evidence` with the same rule.
- Intentionally **no** NOT NULL CHECK — a CHECK would block the auth
  ON DELETE SET NULL anonymization UPDATE escape.
- pgTAP plan=8 from assertion call sites: null direct-insert reject, attributed
  direct insert accept, manager RPC dismiss accept + actor stamp, account
  deletion anonymization still clears only `actor_user_id`.

## Alone-OK

Orthogonal to inventory actor attribution (#1280), purchase-line recorder
attribution (#1292), purchase-decision locale pins (#482/#538/#539), and
MISE-004B pattern advisory (#1249). Does not rewrite
`record_purchase_decision_base_event`,
`record_purchase_decision_compensation`, or
`reject_purchase_decision_event_mutation`. Does not restore table-level NOT NULL.

## Verification

- `npm run typecheck`
- focused purchase-decision actor suite
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
- `npm run supabase:test` — not run in this environment (Docker)
