-- Fail closed forged approve_count_session inventory ledger sources.
--
-- `public.record_inventory_event` accepted any trimmed `p_source` (1–80 chars).
-- The only production writer that stamps `approve_count_session` is
-- `private.service_approve_inventory_count_session`, which inserts count rows
-- under the service_role Edge path where auth.uid() is null. An authenticated
-- owner/admin/manager could call record_inventory_event with
-- `source = 'approve_count_session'` on receipt/waste/usage/adjustment/
-- transfer/stockout/correction (or even a forged count), move on-hand, and
-- make Activity look like audited count-session approval.
--
-- A BEFORE INSERT trigger covers every authenticated write path:
-- record_inventory_event, outbox replay, and any future SECURITY DEFINER
-- caller that preserves auth.uid(). Service-role session approval and
-- unauthenticated fixture seeds remain unchanged.
--
-- Preserves auth, role gates, tenant isolation, RLS, grants, and append-only
-- behavior. Nothing is relaxed. Orthogonal to count-session source authority
-- (#393), which requires this label on counts rather than blocking the label
-- on authenticated inserts of other event types.

create or replace function private.reject_forged_approve_count_session_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is not null
    and lower(btrim(coalesce(new.source, ''))) = 'approve_count_session'
  then
    raise exception
      'Inventory event source cannot claim count-session provenance'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_forged_approve_count_session_source
  on public.inventory_events;
create trigger reject_forged_approve_count_session_source
before insert on public.inventory_events
for each row execute function private.reject_forged_approve_count_session_source();

revoke all on function private.reject_forged_approve_count_session_source()
  from public, anon, authenticated, service_role;

comment on function private.reject_forged_approve_count_session_source() is
  'Rejects authenticated inventory_events inserts whose source is approve_count_session, so a manager JWT cannot forge count-session provenance while moving on-hand.';
