-- Restaurant-memory inserts that claim a manager decision must carry
-- corrected_by.
--
-- `public.restaurant_memories.corrected_by` is nullable so account-deletion
-- anonymization can clear only the deleted operator's auth identity while
-- preserving the memory's operational history (ON DELETE SET NULL). Hosted
-- public.update_restaurant_memory stamps auth.uid() into corrected_by via
-- UPDATE for confirmed, corrected, dismissed, forgotten, and disabled
-- decisions, but any INSERT that reaches the table can still mint those
-- decision statuses with corrected_by null.
--
-- Writers normally INSERT active learned patterns and only later UPDATE into
-- a decision status, so those pre-decision inserts legitimately leave
-- corrected_by null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when status is a manager decision and
-- corrected_by is null. Account-deletion anonymization UPDATEs remain
-- allowed — there is intentionally no NOT NULL / status-implies-actor CHECK,
-- because a CHECK would block the ON DELETE SET NULL escape.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite update_restaurant_memory. History is never rewritten.
-- Nothing is relaxed.

create or replace function private.enforce_restaurant_memory_decision_actor_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('confirmed', 'corrected', 'dismissed', 'forgotten', 'disabled')
    and new.corrected_by is null
  then
    raise exception
      'Restaurant memory decision actor is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists restaurant_memory_decision_actor_evidence
  on public.restaurant_memories;
create trigger restaurant_memory_decision_actor_evidence
before insert on public.restaurant_memories
for each row execute function private.enforce_restaurant_memory_decision_actor_evidence();

revoke all on function private.enforce_restaurant_memory_decision_actor_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_restaurant_memory_decision_actor_evidence() is
  'Fail closed: restaurant_memories INSERT requires a non-null corrected_by when status is a manager decision. Account-deletion anonymization UPDATEs remain permitted.';
