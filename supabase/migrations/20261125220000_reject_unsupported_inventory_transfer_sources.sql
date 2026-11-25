-- Fail closed inventory transfer sources outside the production write-path label.
--
-- `public.record_inventory_event` accepted any trimmed `p_source` (1–80 chars).
-- The only production transfer write path (PR #1100 `transfer_inventory`) stamps:
--   - transfer_inventory (staff+ station transfer; quantity-0 ledger row)
-- An authenticated owner/admin/manager could therefore append a transfer row
-- with an arbitrary source such as `manual`, `operator_transfer`, `demo_transfer`,
-- or a case variant. On today's projection that:
--   - still moves on-hand (signed delta via the non-specialized branch)
--   - still raises operational Activity (which keys on event_type, not source)
--   - forges or blanks Activity / history provenance that expects the
--     transfer_inventory write-path label
--
-- A BEFORE INSERT trigger covers every write path: record_inventory_event,
-- outbox replay, transfer_inventory direct insert, and any future SECURITY
-- DEFINER caller. Exact trim match (no case folding) keeps `Transfer_Inventory`
-- from bypassing the allowlist while remaining orthogonal to the mismatched
-- operator_* guard (transfer_inventory does not start with operator_).
--
-- Preserves auth, role gates, tenant isolation, RLS, grants, and append-only
-- behavior. Nothing is relaxed. Orthogonal to receipt/waste/stockout/usage/
-- adjustment-source allowlisting and operator_*/event_type match guards.
-- Demo seed rows that stamp `demo_transfer` (if any) live only in the in-memory
-- demo repository and never hit this table.

create or replace function private.reject_unsupported_inventory_transfer_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.event_type = 'transfer'
    and btrim(coalesce(new.source, '')) is distinct from 'transfer_inventory'
  then
    raise exception
      'Inventory transfer source must be transfer_inventory'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_unsupported_inventory_transfer_source
  on public.inventory_events;
create trigger reject_unsupported_inventory_transfer_source
before insert on public.inventory_events
for each row execute function private.reject_unsupported_inventory_transfer_source();

revoke all on function private.reject_unsupported_inventory_transfer_source()
  from public, anon, authenticated, service_role;

comment on function private.reject_unsupported_inventory_transfer_source() is
  'Rejects inventory_events transfer rows whose source is not exactly transfer_inventory, so arbitrary labels cannot move on-hand while forging transfer write-path provenance.';
