-- Activity-event inserts that claim actor_type = 'user' must carry
-- actor_user_id.
--
-- `public.activity_events.actor_user_id` is nullable so mise / system /
-- integration actors can leave it null, and so account-deletion
-- anonymization can clear only the deleted operator's auth identity while
-- preserving the activity's operational history (ON DELETE SET NULL + the
-- append-only UPDATE escape). There is intentionally no table CHECK that
-- forces actor_user_id whenever actor_type = 'user', because that CHECK
-- would block the anonymization escape.
--
-- Hosted private.append_activity_event forwards actor_type and actor_user_id
-- without requiring them to agree. Any INSERT that reaches the table can
-- still mint actor_type = 'user' with actor_user_id null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when actor_type = 'user' and
-- actor_user_id is null. Account-deletion anonymization UPDATEs remain
-- allowed — there is intentionally no tighter NOT NULL / user-implies-actor
-- CHECK.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite append_activity_event. History is never rewritten.
-- Nothing is relaxed. Orthogonal to activity resolution-actor evidence.

create or replace function private.enforce_activity_user_actor_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.actor_type = 'user' and new.actor_user_id is null then
    raise exception
      'Activity user actor is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists activity_user_actor_evidence
  on public.activity_events;
create trigger activity_user_actor_evidence
before insert on public.activity_events
for each row execute function private.enforce_activity_user_actor_evidence();

revoke all on function private.enforce_activity_user_actor_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_activity_user_actor_evidence() is
  'Fail closed: activity_events INSERT requires a non-null actor_user_id when actor_type = user. Account-deletion anonymization UPDATEs remain permitted.';
