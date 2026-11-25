-- Fail closed inventory adjustment sources outside the production write-path label.
--
-- `public.record_inventory_event` accepted any trimmed `p_source` (1–80 chars).
-- Production adjustment mutations only stamp:
--   - operator_adjustment (manager Record adjustment via requireInventoryAdjustment)
-- An authenticated owner/admin/manager could therefore append an adjustment row
-- with an arbitrary source such as `manual`, `receiving`, `demo_adjustment`, or a
-- case variant. That:
--   - still moves on-hand (signed delta)
--   - still raises operational Activity (which keys on event_type, not source)
--   - forges or blanks Activity / history provenance that expects the
--     operator_adjustment write-path label
--
-- A BEFORE INSERT trigger covers every write path: record_inventory_event,
-- outbox replay, and any future SECURITY DEFINER caller. Exact trim match
-- (no case folding) keeps `Operator_Adjustment` from bypassing the allowlist while
-- remaining orthogonal to the mismatched-operator_* guard.
--
-- Preserves auth, role gates, tenant isolation, RLS, grants, and append-only
-- behavior. Nothing is relaxed. Orthogonal to receipt/waste/stockout/usage-source
-- allowlisting and operator_*/event_type match guards. Demo seed rows that stamp
-- `demo_adjustment` (if any) live only in the in-memory demo repository and never
-- hit this table.

create or replace function private.reject_unsupported_inventory_adjustment_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.event_type = 'adjustment'
    and btrim(coalesce(new.source, '')) is distinct from 'operator_adjustment'
  then
    raise exception
      'Inventory adjustment source must be operator_adjustment'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_unsupported_inventory_adjustment_source
  on public.inventory_events;
create trigger reject_unsupported_inventory_adjustment_source
before insert on public.inventory_events
for each row execute function private.reject_unsupported_inventory_adjustment_source();

revoke all on function private.reject_unsupported_inventory_adjustment_source()
  from public, anon, authenticated, service_role;

comment on function private.reject_unsupported_inventory_adjustment_source() is
  'Rejects inventory_events adjustment rows whose source is not exactly operator_adjustment, so arbitrary labels cannot move on-hand while forging adjustment write-path provenance.';
