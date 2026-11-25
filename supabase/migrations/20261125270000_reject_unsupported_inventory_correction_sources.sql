-- Fail closed inventory correction sources outside the production write-path label.
--
-- `public.record_inventory_event` accepted any trimmed `p_source` (1–80 chars).
-- The production correction write paths (PR #345 waste correction, PR #350 receipt
-- correction) stamp:
--   - operator_correction (manager append-only superseding repair)
-- An authenticated owner/admin/manager could therefore append a correction row
-- with an arbitrary source such as `manual`, `demo_correction`, `Operator_Correction`,
-- or a mismatched `operator_waste` / `operator_receipt` label. On today's projection
-- that:
--   - still moves on-hand (signed delta via the non-specialized branch)
--   - still raises operational Activity (which keys on event_type, not source)
--   - forges or blanks Activity / history provenance that expects the
--     operator_correction write-path label
--
-- A BEFORE INSERT trigger covers every write path: record_inventory_event,
-- outbox replay, and any future SECURITY DEFINER caller. Exact trim match (no
-- case folding) keeps `Operator_Correction` from bypassing the allowlist.
-- Orthogonality:
--   - orphan supersede requirement stays with #394
--   - exact-reverse quantity contract stays with #395
--   - mismatched operator_* / event_type match stays with #1264
--   - other event-type source allowlists stay with #1259–#1269
-- Demo seed rows that stamp other labels live only in the in-memory demo
-- repository and never hit this table.

create or replace function private.reject_unsupported_inventory_correction_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.event_type = 'correction'
    and btrim(coalesce(new.source, '')) is distinct from 'operator_correction'
  then
    raise exception
      'Inventory correction source must be operator_correction'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_unsupported_inventory_correction_source
  on public.inventory_events;
create trigger reject_unsupported_inventory_correction_source
before insert on public.inventory_events
for each row execute function private.reject_unsupported_inventory_correction_source();

revoke all on function private.reject_unsupported_inventory_correction_source()
  from public, anon, authenticated, service_role;

comment on function private.reject_unsupported_inventory_correction_source() is
  'Rejects inventory_events correction rows whose source is not exactly operator_correction, so arbitrary labels cannot move on-hand while forging correction write-path provenance.';
