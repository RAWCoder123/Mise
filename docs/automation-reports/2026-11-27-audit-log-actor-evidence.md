# Audit log actor INSERT evidence (2026-11-27)

## Gap

`audit_logs.actor_user_id` is nullable so account-deletion anonymization can
clear only the deleted operator's auth identity (`ON DELETE SET NULL`). Hosted
`private.service_record_edge_audit_log` already rejects a null actor, but
direct inserts (including service_role) can still mint unattributable audit
rows with `actor_user_id = null`.

## Change

- Domain: `validateAuditLogActorEvidence` → `missing_actor_user_id`
- Additive BEFORE INSERT tip only on `public.audit_logs`
- No NOT NULL / tighter CHECK (preserves anonymization UPDATEs)
- Does not rewrite `service_record_edge_audit_log`
- pgTAP plan = 8 (derived from assertion call sites)

## Alone-OK

Orthogonal to audit_logs ASCII-C / cntrl locale pins, activity user-actor tip
(#1301), inventory / purchase-line / mise-action / count-session actor tips.
Does not invent unconditional table-level NOT NULL.

## Verification

- `npm run typecheck`
- focused `auditLogActorEvidence` suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker `npm run supabase:test` when available
