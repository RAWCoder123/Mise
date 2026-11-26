# Inventory count-session started_by INSERT evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-count-session-started-by-evidence-main`

## Gap

`public.inventory_count_sessions.started_by` is nullable so account deletion
can anonymize only the starter while preserving the session's operational
history. Hosted `private.service_begin_inventory_count_session` stamps
`p_actor_user_id`, but any insert path that reaches the table can still mint
an unattributable count session with `started_by = null` — a physical-count
workflow Activity / audit analysis cannot pin to an operator.

## Change

- Domain: `validateInventoryCountSessionStartedByEvidence` rejects
  `missing_started_by` when the starter id is null, undefined, or blank.
- Additive BEFORE INSERT trigger
  `private.enforce_inventory_count_session_started_by_evidence` with the same
  rule.
- Intentionally **no** NOT NULL CHECK — a CHECK would block the auth
  ON DELETE SET NULL anonymization UPDATE escape.
- Does not require `submitted_by` / `approved_by` / `cancelled_by` at INSERT
  time (those are stamped by later workflow steps).
- pgTAP plan=8 from assertion call sites: null direct-insert reject,
  attributed direct insert accept, begin RPC accept + started_by stamp,
  account-deletion anonymization still clears only `started_by`.

## Alone-OK

Orthogonal to inventory actor attribution (#1280), count-session provenance
on ledger rows (#393), scoped cycle sessions (#1107), begin-resume (#384),
return-for-revision (#283), and approve_count_session source authority
(#1262). Does not rewrite begin/submit/approve/cancel writers or restore
table-level NOT NULL. Does not modify shared
`inventory_count_sessions.test.sql`.

## Verification

- `npm run typecheck`
- focused started-by suite
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
- `npm run supabase:test` — not run in this environment (Docker)
