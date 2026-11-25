-- Fail closed inventory usage sources outside the production write-path label.
--
-- `public.record_inventory_event` accepted any trimmed `p_source` (1–80 chars).
-- Production usage mutations only stamp:
--   - operator_usage (manager Record usage via requireInventoryUsage)
-- An authenticated owner/admin/manager could therefore append a usage row
-- with an arbitrary source such as `manual`, `receiving`, `demo_usage`, or a
-- case variant. That:
--   - still decreases on-hand
--   - still raises operational Activity (which keys on event_type, not source)
--   - forges or blanks Activity / history provenance that expects the
--     operator_usage write-path label
--
-- A BEFORE INSERT trigger covers every write path: record_inventory_event,
-- outbox replay, and any future SECURITY DEFINER caller. Exact trim match
-- (no case folding) keeps `Operator_Usage` from bypassing the allowlist while
-- remaining orthogonal to the mismatched-operator_* guard.
--
-- Preserves auth, role gates, tenant isolation, RLS, grants, and append-only
-- behavior. Nothing is relaxed. Orthogonal to receipt/waste/stockout-source
-- allowlisting and operator_*/event_type match guards. Demo seed rows that stamp
-- `demo_usage` (if any) live only in the in-memory demo repository and never
-- hit this table.

create or replace function private.reject_unsupported_inventory_usage_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.event_type = 'usage'
    and btrim(coalesce(new.source, '')) is distinct from 'operator_usage'
  then
    raise exception
      'Inventory usage source must be operator_usage'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_unsupported_inventory_usage_source
  on public.inventory_events;
create trigger reject_unsupported_inventory_usage_source
before insert on public.inventory_events
for each row execute function private.reject_unsupported_inventory_usage_source();

revoke all on function private.reject_unsupported_inventory_usage_source()
  from public, anon, authenticated, service_role;

comment on function private.reject_unsupported_inventory_usage_source() is
  'Rejects inventory_events usage rows whose source is not exactly operator_usage, so arbitrary labels cannot decrease on-hand while forging usage write-path provenance.';
