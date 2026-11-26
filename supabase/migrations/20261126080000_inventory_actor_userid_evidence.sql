-- Inventory ledger inserts must carry an actor_user_id.
--
-- `public.inventory_events.actor_user_id` was originally NOT NULL. Account
-- deletion anonymization later made the column nullable and taught the
-- append-only UPDATE trigger to allow ON DELETE SET NULL clearing of only that
-- field. Hosted `public.record_inventory_event` stamps auth.uid(), but any
-- insert path that reaches the table can still mint an unattributable row
-- with actor_user_id null and rewrite on-hand.
--
-- This migration fails closed at the database boundary for every INSERT
-- (record_inventory_event, count-session approval, outbox, future service
-- inserts) when actor_user_id is null. Account-deletion anonymization UPDATEs
-- remain allowed — there is intentionally no NOT NULL CHECK, because a CHECK
-- would block the ON DELETE SET NULL escape.
--
-- Domain acceptInventoryEvent mirrors the same rejection reason.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, append-only behavior, and actor anonymization.
-- Nothing is relaxed. Orthogonal to reason-code, source, transfer metadata,
-- and purchase-line tips.

create or replace function private.enforce_inventory_actor_userid_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.actor_user_id is null then
    raise exception
      'Inventory event actor is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_events_actor_userid_evidence
  on public.inventory_events;
create trigger inventory_events_actor_userid_evidence
before insert on public.inventory_events
for each row execute function private.enforce_inventory_actor_userid_evidence();

revoke all on function private.enforce_inventory_actor_userid_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_inventory_actor_userid_evidence() is
  'Fail closed: inventory_events INSERT requires a non-null actor_user_id. Account-deletion anonymization UPDATEs remain permitted.';
