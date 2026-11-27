-- Audit-log inserts must carry an actor_user_id.
--
-- `public.audit_logs.actor_user_id` is nullable so account-deletion
-- anonymization can clear only the deleted operator's auth identity while
-- preserving the audit row's operational history (ON DELETE SET NULL). There
-- is intentionally no table CHECK / NOT NULL that forces an actor on every
-- row, because that would block the FK anonymization UPDATE.
--
-- Hosted private.service_record_edge_audit_log already rejects a null
-- p_actor_user_id. Any other INSERT that reaches the table (including direct
-- service_role inserts) can still mint an unattributable audit row with
-- actor_user_id null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when actor_user_id is null.
-- Account-deletion anonymization UPDATEs remain allowed — there is
-- intentionally no NOT NULL CHECK.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite service_record_edge_audit_log. History is never rewritten.
-- Nothing is relaxed. Orthogonal to audit_logs ASCII-C / cntrl locale pins.

create or replace function private.enforce_audit_log_actor_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.actor_user_id is null then
    raise exception
      'Audit log actor is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists audit_log_actor_evidence
  on public.audit_logs;
create trigger audit_log_actor_evidence
before insert on public.audit_logs
for each row execute function private.enforce_audit_log_actor_evidence();

revoke all on function private.enforce_audit_log_actor_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_audit_log_actor_evidence() is
  'Fail closed: audit_logs INSERT requires a non-null actor_user_id. Account-deletion anonymization UPDATEs remain permitted.';
