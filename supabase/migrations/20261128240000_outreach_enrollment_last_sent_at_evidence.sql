-- Outreach enrollment inserts that claim contacted must carry last_sent_at.
--
-- `public.outreach_enrollments.last_sent_at` is nullable because queued /
-- awaiting_review / ready / processing / suppressed / attention_required rows
-- legitimately leave it null until a later send UPDATE stamps the timestamp.
-- Soft table constraints do not require last_sent_at when status claims
-- contacted. Hosted send transitions already stamp last_sent_at on UPDATE into
-- status = 'contacted' (or 'completed' after the final follow-up), but any
-- INSERT that reaches the table can still mint a contacted enrollment with
-- last_sent_at null.
--
-- Authenticated client DML is revoked; service_role retains INSERT and can
-- still mint untimed contacted claims directly. Enrollment writers INSERT
-- status = 'queued' with last_sent_at null until a later send path stamps
-- evidence on UPDATE.
--
-- This migration fails closed at the database boundary for every INSERT when
-- status is already 'contacted' and last_sent_at is null. Queued / ready /
-- processing / completed / replied / suppressed inserts and send UPDATEs
-- remain allowed — there is intentionally no NOT NULL /
-- status-implies-timestamp CHECK, because a CHECK would expand beyond this
-- INSERT-only tip boundary.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite outreach-agent writers. History is never rewritten.
-- Nothing is relaxed.
-- Alone-OK vs tip stacks #1263–#1332, including outreach message sent_at
-- (#1328), outreach agent run completed_at (#1329), and outreach campaign
-- activated_at (#1332). Soft contested merge: none expected.

create or replace function private.enforce_outreach_enrollment_last_sent_at_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'contacted'
    and new.last_sent_at is null
  then
    raise exception
      'Outreach enrollment send time is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists outreach_enrollments_last_sent_at_evidence
  on public.outreach_enrollments;
create trigger outreach_enrollments_last_sent_at_evidence
before insert on public.outreach_enrollments
for each row execute function private.enforce_outreach_enrollment_last_sent_at_evidence();

revoke all on function private.enforce_outreach_enrollment_last_sent_at_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_outreach_enrollment_last_sent_at_evidence() is
  'Fail closed: outreach_enrollments INSERT requires a non-null last_sent_at when status is contacted. Queued/ready/processing/completed/replied/suppressed inserts and send UPDATEs remain permitted.';
