-- Fail closed mismatched operator_* inventory ledger sources.
--
-- `public.record_inventory_event` accepted any trimmed `p_source` (1–80 chars).
-- Production operator mutations always stamp `operator_${event_type}` via
-- `requireInventoryOperation` (receipt → operator_receipt, waste →
-- operator_waste, count → operator_count, stockout → operator_stockout).
-- An authenticated owner/admin/manager could therefore append, for example,
-- event_type = waste with source = operator_receipt (or a case variant), move
-- on-hand, and make Activity / delivery history classify the wrong write-path
-- provenance.
--
-- A BEFORE INSERT trigger covers every write path: record_inventory_event,
-- outbox replay, and any future SECURITY DEFINER caller. Case-insensitive
-- prefix detection plus exact expected form keeps `Operator_Waste` from
-- bypassing the match while still accepting exact `operator_<event_type>`.
-- Non-operator labels (supplier_delivery, approve_count_session, POS sources)
-- remain unconstrained by this guard.
--
-- Preserves auth, role gates, tenant isolation, RLS, grants, and append-only
-- behavior. Nothing is relaxed. Orthogonal to receipt-source allowlisting and
-- approve_count_session / mise-attribution forgery guards.

create or replace function private.reject_mismatched_operator_inventory_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  trimmed_source text := btrim(coalesce(new.source, ''));
begin
  if starts_with(lower(trimmed_source), 'operator_')
    and trimmed_source is distinct from ('operator_' || new.event_type)
  then
    raise exception
      'Inventory operator source must match the operation'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_mismatched_operator_inventory_source
  on public.inventory_events;
create trigger reject_mismatched_operator_inventory_source
before insert on public.inventory_events
for each row execute function private.reject_mismatched_operator_inventory_source();

revoke all on function private.reject_mismatched_operator_inventory_source()
  from public, anon, authenticated, service_role;

comment on function private.reject_mismatched_operator_inventory_source() is
  'Rejects inventory_events rows whose source starts with operator_ but is not exactly operator_<event_type>, so mismatched or case-variant operator labels cannot move on-hand under the wrong write-path provenance.';
