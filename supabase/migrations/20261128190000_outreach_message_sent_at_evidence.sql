-- Outreach message inserts that claim sent/delivered must carry sent_at.
--
-- `public.outreach_messages.sent_at` is nullable because draft / approved /
-- sending / failed / send_unknown rows legitimately leave it null until a
-- later send UPDATE stamps the timestamp. Soft table constraints only require
-- approved_at when status = 'approved'. Hosted send transitions already stamp
-- sent_at on UPDATE into status = 'sent', but any INSERT that reaches the
-- table can still mint a sent or delivered message with sent_at null.
--
-- Authenticated client DML is revoked; service_role retains INSERT and can
-- still mint untimed send claims directly. Draft writers INSERT status =
-- 'draft' or 'approved' with sent_at null until a later send path stamps
-- evidence on UPDATE.
--
-- This migration fails closed at the database boundary for every INSERT when
-- status is already 'sent' or 'delivered' and sent_at is null. Draft /
-- failure inserts and mark-sent UPDATEs remain allowed — there is
-- intentionally no NOT NULL / status-implies-timestamp CHECK, because a CHECK
-- would block legitimate draft / failure rows.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite outreach-agent / outreach-webhook writers. History is never
-- rewritten. Nothing is relaxed.
-- Alone-OK vs tip stacks #1263–#1327 and mise_actions failure evidence (#1305).
-- Sibling of outreach message failure evidence (#1326) and supplier-order
-- sent_at evidence (#1319).

create or replace function private.enforce_outreach_message_sent_at_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('sent', 'delivered')
    and new.sent_at is null
  then
    raise exception
      'Outreach message send time is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists outreach_messages_sent_at_evidence
  on public.outreach_messages;
create trigger outreach_messages_sent_at_evidence
before insert on public.outreach_messages
for each row execute function private.enforce_outreach_message_sent_at_evidence();

revoke all on function private.enforce_outreach_message_sent_at_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_outreach_message_sent_at_evidence() is
  'Fail closed: outreach_messages INSERT requires a non-null sent_at when status is sent or delivered. Draft/failure inserts and mark-sent UPDATEs remain permitted.';
