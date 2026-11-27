# Mise-actions decision actor INSERT evidence

Date: 2026-11-27  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-actions-decision-actor-evidence-main`

## Gap

`public.mise_actions.approved_by` is nullable so account deletion can anonymize
only the operator while preserving the action's operational history. Hosted
`public.decide_mise_action` stamps `auth.uid()` into `approved_by` via UPDATE
for both approve and reject decisions, but any insert path that reaches the
table can still mint an `approved` or `rejected` action with `approved_by`
null — a decision Activity / audit analysis cannot pin to an operator.
Writers normally INSERT `prepared` / `waiting_for_approval` and only later
UPDATE into a decision status, so those pre-decision inserts legitimately
leave `approved_by` null.

## Change

- Domain: `validateMiseActionsDecisionActorEvidence` rejects
  `missing_approved_by` when status is `approved` or `rejected` without a
  non-empty actor id.
- Additive BEFORE INSERT tip
  `private.enforce_mise_actions_decision_actor_evidence` with the same rule.
- Intentionally **no** NOT NULL / status-implies-actor CHECK — a CHECK would
  block the auth ON DELETE SET NULL anonymization UPDATE escape.
- Does not require `approved_by` when status is still pre-decision
  (`prepared` / `waiting_for_approval` / etc.). Does not rewrite
  `decide_mise_action`.
- pgTAP plan=11 from assertion call sites: two null-actor rejects, two
  attributed accepts, waiting_for_approval accept, decide_mise_action accept +
  approved_by stamp, account-deletion anonymization preserves business fields.

## Alone-OK

Orthogonal to domain ASCII-C approvedBy identity (#800), mise_actions locale
pins (#441/#457/#510/#576–#580), inventory / count-session / purchase-line /
supplier-delivery actor tips (#1280/#1292/#1295/#1296/#1297). Does not rewrite
`decide_mise_action` or restore table-level NOT NULL. Does not modify shared
`operational_backend_foundation.test.sql`.

## Verification

- `npm run typecheck`
- focused decision-actor suite
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
- `npm run supabase:test` — not run in this environment when Docker unavailable
