-- Fail closed inventory waste sources outside the production write-path label.
--
-- `public.record_inventory_event` accepted any trimmed `p_source` (1–80 chars).
-- Production waste mutations only stamp:
--   - operator_waste (ad-hoc inventory waste / Waste record via
--     requireInventoryOperation)
-- An authenticated owner/admin/manager could therefore append a waste row with
-- an arbitrary source such as `manual`, `receiving`, `demo_waste`, or a case
-- variant. That:
--   - still moves on-hand
--   - still enters waste analysis (which keys on event_type, not source)
--   - forges or blanks Activity / history provenance that expects the
--     operator_waste write-path label
--
-- A BEFORE INSERT trigger covers every write path: record_inventory_event,
-- outbox replay, and any future SECURITY DEFINER caller. Exact trim match
-- (no case folding) keeps `Operator_Waste` from bypassing the allowlist while
-- remaining orthogonal to the mismatched-operator_* guard.
--
-- Preserves auth, role gates, tenant isolation, RLS, grants, and append-only
-- behavior. Nothing is relaxed. Orthogonal to receipt-source allowlisting
-- and operator_*/event_type match guards. Demo seed rows that stamp
-- `demo_waste` live only in the in-memory demo repository and never hit this
-- table.

create or replace function private.reject_unsupported_inventory_waste_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.event_type = 'waste'
    and btrim(coalesce(new.source, '')) is distinct from 'operator_waste'
  then
    raise exception
      'Inventory waste source must be operator_waste'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_unsupported_inventory_waste_source
  on public.inventory_events;
create trigger reject_unsupported_inventory_waste_source
before insert on public.inventory_events
for each row execute function private.reject_unsupported_inventory_waste_source();

revoke all on function private.reject_unsupported_inventory_waste_source()
  from public, anon, authenticated, service_role;

comment on function private.reject_unsupported_inventory_waste_source() is
  'Rejects inventory_events waste rows whose source is not exactly operator_waste, so arbitrary labels cannot move on-hand while forging waste write-path provenance.';
