-- Restaurant-memory inserts that claim a manager decision must carry
-- corrected_at.
--
-- `public.restaurant_memories.corrected_at` is nullable because pre-decision
-- `active` learned-pattern inserts and other non-decision rows legitimately
-- leave it null. Hosted public.update_restaurant_memory stamps corrected_at
-- to now() via UPDATE for confirmed, corrected, dismissed, forgotten, and
-- disabled decisions (alongside corrected_by), but any INSERT that reaches
-- the table can still mint those decision statuses with corrected_at null.
--
-- Writers normally INSERT active learned patterns and only later UPDATE into
-- a decision status, so those pre-decision inserts legitimately leave
-- corrected_at null. Account-deletion anonymization clears corrected_by via
-- ON DELETE SET NULL but preserves corrected_at, so decision history remains
-- time-attributable even after the operator identity is removed.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when status is a manager decision and
-- corrected_at is null. Decision UPDATEs and active inserts remain allowed —
-- there is intentionally no NOT NULL / status-implies-timestamp CHECK, so
-- this tip stays INSERT-only and orthogonal to the companion corrected_by
-- actor tip.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite update_restaurant_memory. History is never rewritten.
-- Nothing is relaxed.

create or replace function private.enforce_restaurant_memory_decision_time_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('confirmed', 'corrected', 'dismissed', 'forgotten', 'disabled')
    and new.corrected_at is null
  then
    raise exception
      'Restaurant memory decision time is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists restaurant_memory_decision_time_evidence
  on public.restaurant_memories;
create trigger restaurant_memory_decision_time_evidence
before insert on public.restaurant_memories
for each row execute function private.enforce_restaurant_memory_decision_time_evidence();

revoke all on function private.enforce_restaurant_memory_decision_time_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_restaurant_memory_decision_time_evidence() is
  'Fail closed: restaurant_memories INSERT requires a non-null corrected_at when status is a manager decision. Active inserts and decision UPDATEs remain permitted.';
