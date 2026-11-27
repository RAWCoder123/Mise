-- Inventory count-session inserts that claim approved status must carry
-- submitted_at.
--
-- Soft CHECKs already require submitted_at when status is submitted, and
-- approved_at when status is approved. They do not require submitted_at on an
-- already-approved row. Hosted approve advances a previously submitted session
-- via UPDATE and therefore inherits the stamped submit timestamp; it never
-- needs to INSERT an approved row.
--
-- On current main, any INSERT that reaches the table can still mint
-- status = 'approved' with approved_at / approved_by set and submitted_at null
-- — an approval claim that never carries submit-time evidence. Client DML is
-- revoked; service_role / direct INSERT paths still reach the table.
--
-- This migration fails closed at the database boundary for every INSERT when
-- status is already 'approved' and submitted_at is null. in_progress /
-- submitted / cancelled inserts and approve UPDATEs remain allowed — there is
-- intentionally no status-implies-submitted_at CHECK for approved rows, so
-- this tip stays INSERT-only and does not invent submit history on UPDATE.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite begin / submit / approve / cancel writers. History is never
-- rewritten. Nothing is relaxed.
-- Contested merge: #1296 attributed approved fixture needs submitted_at once
-- this lands. Orthogonal to #1295 started_by and #1296 workflow actors.

create or replace function private.enforce_inventory_count_session_approved_submit_time_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'approved'
    and new.submitted_at is null
  then
    raise exception
      'Inventory count session submit time is required for approved inserts'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_count_sessions_approved_submit_time_evidence
  on public.inventory_count_sessions;
create trigger inventory_count_sessions_approved_submit_time_evidence
before insert on public.inventory_count_sessions
for each row execute function private.enforce_inventory_count_session_approved_submit_time_evidence();

revoke all on function private.enforce_inventory_count_session_approved_submit_time_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_inventory_count_session_approved_submit_time_evidence() is
  'Fail closed: inventory_count_sessions INSERT requires a non-null submitted_at when status is approved. Approve UPDATEs and non-approved inserts remain permitted.';
