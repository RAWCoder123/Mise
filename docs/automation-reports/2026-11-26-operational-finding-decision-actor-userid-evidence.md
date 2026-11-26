# Operational finding-decision actor_user_id INSERT evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-finding-decision-actor-userid-evidence-main`

## Gap

`public.operational_finding_decisions.actor_user_id` is nullable so account
deletion can anonymize only the actor while preserving append-only business
fields. Hosted `public.record_operational_finding_decision` stamps
`auth.uid()`, but any insert path that reaches the table can still mint an
unattributable approve, edit, or dismiss row with `actor_user_id = null` —
finding-feedback / Activity / audit analysis cannot pin to an operator.

## Change

- Domain: `validateOperationalFindingDecisionActorUserIdEvidence` rejects
  `missing_actor_user_id` when the actor id is null, undefined, or blank.
- Additive BEFORE INSERT tip
  `private.enforce_operational_finding_decision_actor_userid_evidence` with
  the same rule.
- Intentionally **no** NOT NULL CHECK — a CHECK would block the auth
  ON DELETE SET NULL anonymization UPDATE escape.
- pgTAP plan=8 from assertion call sites: null direct-insert reject,
  attributed direct insert accept, manager RPC dismiss accept + actor stamp,
  account deletion anonymization still clears only `actor_user_id`.

## Alone-OK

Orthogonal to inventory actor attribution (#1280), purchase-line recorder
attribution (#1292), purchase-decision actor attribution (#1293), and
finding-decision ASCII-C response pins (#795–#799). Does not rewrite
`record_operational_finding_decision` or
`reject_operational_finding_decision_mutation`. Does not restore table-level
NOT NULL.

## Verification

- `npm run typecheck`
- focused operational-finding decision actor suite
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
- `npm run supabase:test` — not run in this environment (Docker)
