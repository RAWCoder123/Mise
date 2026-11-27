-- Activity-event inserts that claim a resolution timestamp must carry
-- resolved_by.
--
-- `public.activity_events.resolved_by` is nullable so account-deletion
-- anonymization can clear only the deleted operator's auth identity while
-- preserving the activity's operational history (ON DELETE SET NULL + the
-- append-only UPDATE escape). The existing resolution CHECK intentionally
-- allows resolved_at without resolved_by after that anonymization escape.
--
-- Hosted private.append_activity_event never writes resolution fields — it
-- always inserts unresolved rows. Any INSERT that reaches the table can still
-- mint a resolved activity with resolved_at set and resolved_by null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when resolved_at is present and
-- resolved_by is null. Account-deletion anonymization UPDATEs remain
-- allowed — there is intentionally no tighter NOT NULL / resolved-implies-
-- actor CHECK, because a CHECK would block the ON DELETE SET NULL escape.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite append_activity_event. History is never rewritten.
-- Nothing is relaxed.

create or replace function private.enforce_activity_resolution_actor_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.resolved_at is not null and new.resolved_by is null then
    raise exception
      'Activity resolution actor is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists activity_resolution_actor_evidence
  on public.activity_events;
create trigger activity_resolution_actor_evidence
before insert on public.activity_events
for each row execute function private.enforce_activity_resolution_actor_evidence();

revoke all on function private.enforce_activity_resolution_actor_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_activity_resolution_actor_evidence() is
  'Fail closed: activity_events INSERT requires a non-null resolved_by when resolved_at is set. Account-deletion anonymization UPDATEs remain permitted.';
