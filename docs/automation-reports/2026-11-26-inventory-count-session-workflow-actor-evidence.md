# Inventory count-session workflow actor INSERT evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-count-session-workflow-actor-evidence-main`

## Gap

`public.inventory_count_sessions.submitted_by` / `approved_by` /
`cancelled_by` are nullable so account deletion can anonymize only the
operator while preserving the session's operational history. Soft CHECKs
already require the matching `*_at` timestamp when status is submitted /
approved / cancelled, but they do not require the matching actor column.
Hosted submit / approve / cancel RPCs stamp `p_actor_user_id` via UPDATE, but
any insert path that reaches the table can still mint a terminal-status count
session with a matching timestamp and a null workflow actor — a physical-count
workflow Activity / audit analysis cannot pin to an operator.

## Change

- Domain: `validateInventoryCountSessionWorkflowActorEvidence` rejects
  `missing_submitted_by` / `missing_approved_by` / `missing_cancelled_by`
  when status claims that workflow step without a non-empty actor id.
- Additive BEFORE INSERT tip
  `private.enforce_inventory_count_session_workflow_actor_evidence` with the
  same rule.
- Intentionally **no** NOT NULL / status-implies-actor CHECK — a CHECK would
  block the auth ON DELETE SET NULL anonymization UPDATE escape.
- Does not require workflow actors when status is `in_progress` (those are
  stamped by later workflow steps). Does not rewrite begin/submit/approve/
  cancel writers.
- pgTAP plan=11 from assertion call sites: three null-actor rejects, two
  attributed accepts, begin RPC accept + started_by stamp, account-deletion
  anonymization preserves business fields.

## Alone-OK

Orthogonal to starter attribution (#1295), inventory actor attribution
(#1280), count-session provenance on ledger rows (#393), scoped cycle
sessions (#1107), begin-resume (#384), return-for-revision (#283), and
approve_count_session source authority (#1262). Does not rewrite
begin/submit/approve/cancel writers or restore table-level NOT NULL. Does not
modify shared `inventory_count_sessions.test.sql`.

Contested merge: #1295 attributed cancelled fixture needs `cancelled_by`
once this tip lands (its accept path currently inserts `cancelled` with only
`started_by` + `cancelled_at`).

## Verification

- `npm run typecheck`
- focused workflow-actor suite
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
- `npm run supabase:test` — not run in this environment (Docker)
