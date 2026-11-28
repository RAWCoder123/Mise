-- Inventory count-session inserts that claim approved status must carry
-- submitted_by.
--
-- Soft CHECKs already require submitted_at when status is submitted, and
-- approved_at when status is approved. They do not require submitted_by on an
-- already-approved row. Hosted approve advances a previously submitted session
-- via UPDATE and therefore inherits the stamped submitter; it never needs to
-- INSERT an approved row.
--
-- On current main, any INSERT that reaches the table can still mint
-- status = 'approved' with approved_at / approved_by set and submitted_by null
-- — an approval claim that never carries submitter evidence. Client DML is
-- revoked; service_role / direct INSERT paths still reach the table.
--
-- This migration fails closed at the database boundary for every INSERT when
-- status is already 'approved' and submitted_by is null. in_progress /
-- submitted / cancelled inserts and approve UPDATEs remain allowed — there is
-- intentionally no status-implies-submitted_by CHECK for approved rows, so
-- this tip stays INSERT-only, does not invent submitter history on UPDATE, and
-- does not block account-deletion anonymization (ON DELETE SET NULL).
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite begin / submit / approve / cancel writers. History is never
-- rewritten. Nothing is relaxed.
-- Contested merge: #1296 attributed approved fixture needs submitted_by once
-- this lands. Orthogonal to #1295 started_by, #1296 workflow actors
-- (approved_by only for approved), and #1320 approved submitted_at.

create or replace function private.enforce_inventory_count_session_approved_submitter_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'approved'
    and new.submitted_by is null
  then
    raise exception
      'Inventory count session submitter is required for approved inserts'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_count_sessions_approved_submitter_evidence
  on public.inventory_count_sessions;
create trigger inventory_count_sessions_approved_submitter_evidence
before insert on public.inventory_count_sessions
for each row execute function private.enforce_inventory_count_session_approved_submitter_evidence();

revoke all on function private.enforce_inventory_count_session_approved_submitter_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_inventory_count_session_approved_submitter_evidence() is
  'Fail closed: inventory_count_sessions INSERT requires a non-null submitted_by when status is approved. Approve UPDATEs and non-approved inserts remain permitted.';
