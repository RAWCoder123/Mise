-- Outreach enrollment inserts that claim processing must carry claimed_at.
--
-- `public.outreach_enrollments.claimed_at` is nullable because queued /
-- awaiting_review / ready / contacted / replied / completed / suppressed /
-- attention_required rows legitimately leave it null until a later claim
-- UPDATE stamps the timestamp (and claim-release / timeout paths clear it
-- again). Soft table constraints do not require claimed_at when status claims
-- processing. Tips #1333/#1334 close contacted/completed last_sent_at INSERT
-- only. Hosted claim transitions already stamp claimed_at on UPDATE into
-- status = 'processing', but any INSERT that reaches the table can still mint
-- a processing enrollment with claimed_at null.
--
-- Authenticated client DML is revoked; service_role retains INSERT and can
-- still mint untimed processing claims directly. Enrollment writers INSERT
-- status = 'queued' (or ready / awaiting_review) with claimed_at null until a
-- later claim path stamps evidence on UPDATE.
--
-- This migration fails closed at the database boundary for every INSERT when
-- status is already 'processing' and claimed_at is null. Queued / ready /
-- contacted / completed / replied / suppressed inserts and claim UPDATEs
-- remain allowed — there is intentionally no NOT NULL /
-- status-implies-timestamp CHECK, because a CHECK would expand beyond this
-- INSERT-only tip boundary.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite outreach-agent writers. History is never rewritten.
-- Nothing is relaxed.
-- Alone-OK vs tip stacks #1263–#1334, including outreach enrollment
-- contacted/completed last_sent_at (#1333/#1334) and OAuth claimed_at tips
-- (#1330/#1331). Soft contested merge: none expected.

create or replace function private.enforce_outreach_enrollment_processing_claimed_at_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'processing'
    and new.claimed_at is null
  then
    raise exception
      'Outreach enrollment claim time is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists outreach_enrollments_processing_claimed_at_evidence
  on public.outreach_enrollments;
create trigger outreach_enrollments_processing_claimed_at_evidence
before insert on public.outreach_enrollments
for each row execute function private.enforce_outreach_enrollment_processing_claimed_at_evidence();

revoke all on function private.enforce_outreach_enrollment_processing_claimed_at_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_outreach_enrollment_processing_claimed_at_evidence() is
  'Fail closed: outreach_enrollments INSERT requires a non-null claimed_at when status is processing. Queued/ready/contacted/completed/replied/suppressed inserts and claim UPDATEs remain permitted.';
