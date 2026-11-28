-- Outreach message inserts that claim failed/send_unknown must carry
-- last_error.
--
-- `public.outreach_messages.last_error` is nullable because draft / approved /
-- sending / sent / delivered rows legitimately leave it null. Hosted fail and
-- send_unknown transitions already stamp a bounded reason into last_error, but
-- any INSERT that reaches the table can still mint a failed or send_unknown
-- message with last_error null or blank after trim.
--
-- Authenticated client DML is revoked; service_role retains INSERT and can
-- still mint unexplained failures directly. Draft writers INSERT status =
-- 'draft' or 'approved' with last_error null until a later fail / send_unknown
-- path stamps evidence on UPDATE.
--
-- This migration fails closed at the database boundary for every INSERT when
-- status is already 'failed' or 'send_unknown' and last_error is null/blank
-- after trim. Draft / sent inserts and failure UPDATEs remain allowed — there
-- is intentionally no NOT NULL / status-implies-error CHECK, because a CHECK
-- would block legitimate draft / sent rows.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite outreach-agent / outreach-webhook writers. History is never
-- rewritten. Nothing is relaxed.
-- Alone-OK vs tip stacks #1263–#1325 and mise_actions failure evidence (#1305).
-- Sibling of supplier-email delivery failure evidence (#1323).

create or replace function private.enforce_outreach_message_failure_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('failed', 'send_unknown')
    and nullif(btrim(new.last_error), '') is null
  then
    raise exception
      'Outreach message failure evidence is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists outreach_messages_failure_evidence
  on public.outreach_messages;
create trigger outreach_messages_failure_evidence
before insert on public.outreach_messages
for each row execute function private.enforce_outreach_message_failure_evidence();

revoke all on function private.enforce_outreach_message_failure_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_outreach_message_failure_evidence() is
  'Fail closed: outreach_messages INSERT requires a non-empty last_error when status is failed or send_unknown. Draft/sent inserts and failure UPDATEs remain permitted.';
