-- Fail closed inventory stockout sources outside the production write-path label.
--
-- `public.record_inventory_event` accepted any trimmed `p_source` (1–80 chars).
-- Production stockout mutations only stamp:
--   - operator_stockout (ad-hoc inventory stockout / Mark stockout via
--     requireInventoryOperation)
-- An authenticated owner/admin/manager could therefore append a stockout row
-- with an arbitrary source such as `manual`, `receiving`, `demo_stockout`, or a
-- case variant. That:
--   - still zeros on-hand
--   - still raises inventory-risk Activity (which keys on event_type, not source)
--   - forges or blanks Activity / history provenance that expects the
--     operator_stockout write-path label
--
-- A BEFORE INSERT trigger covers every write path: record_inventory_event,
-- outbox replay, and any future SECURITY DEFINER caller. Exact trim match
-- (no case folding) keeps `Operator_Stockout` from bypassing the allowlist while
-- remaining orthogonal to the mismatched-operator_* guard.
--
-- Preserves auth, role gates, tenant isolation, RLS, grants, and append-only
-- behavior. Nothing is relaxed. Orthogonal to receipt/waste-source allowlisting
-- and operator_*/event_type match guards. Demo seed rows that stamp
-- `demo_stockout` (if any) live only in the in-memory demo repository and never
-- hit this table.

create or replace function private.reject_unsupported_inventory_stockout_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.event_type = 'stockout'
    and btrim(coalesce(new.source, '')) is distinct from 'operator_stockout'
  then
    raise exception
      'Inventory stockout source must be operator_stockout'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_unsupported_inventory_stockout_source
  on public.inventory_events;
create trigger reject_unsupported_inventory_stockout_source
before insert on public.inventory_events
for each row execute function private.reject_unsupported_inventory_stockout_source();

revoke all on function private.reject_unsupported_inventory_stockout_source()
  from public, anon, authenticated, service_role;

comment on function private.reject_unsupported_inventory_stockout_source() is
  'Rejects inventory_events stockout rows whose source is not exactly operator_stockout, so arbitrary labels cannot zero on-hand while forging stockout write-path provenance.';
