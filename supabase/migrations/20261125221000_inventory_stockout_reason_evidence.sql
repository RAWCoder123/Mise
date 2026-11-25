-- Stockout ledger events must carry an allowlisted reason_code.
--
-- Hosted `public.record_inventory_event` already accepts stockout for
-- owner/admin/manager. Projection sets on-hand to zero. Without a
-- bounded reason taxonomy, a manager JWT can rewrite stock under stockout
-- semantics with a missing or free-form reason that cannot be compared for
-- coverage learning or purchasing analysis.
--
-- Product writers that surface stockout reasons in UI (#366) stamp:
--   under_ordered | unexpected_demand | delivery_missed | spoilage_cleared |
--   theft_loss | other
-- Notes remain optional. This migration fails closed at the database boundary
-- for every insert path (record_inventory_event, outbox, future service
-- inserts). Receipt, count, waste, usage, adjustment, transfer, and
-- correction keep their own evidence rules.
--
-- NOT VALID CHECKs skip validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
-- Domain acceptInventoryEvent mirrors the same rejection reasons.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.
-- Orthogonal to stockout-source allowlisting, waste reason evidence, and
-- usage/adjustment evidence.

create or replace function private.enforce_inventory_stockout_reason_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_reason text := nullif(pg_catalog.btrim(coalesce(new.reason_code, '')), '');
begin
  if new.event_type = 'stockout' then
    if normalized_reason is null then
      raise exception
        'Inventory stockout events require a reason code'
        using errcode = '22023';
    end if;
    if normalized_reason not in (
      'under_ordered',
      'unexpected_demand',
      'delivery_missed',
      'spoilage_cleared',
      'theft_loss',
      'other'
    ) then
      raise exception
        'Inventory stockout reason code is not allowed'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_events_stockout_reason_evidence
  on public.inventory_events;
create trigger inventory_events_stockout_reason_evidence
before insert on public.inventory_events
for each row execute function private.enforce_inventory_stockout_reason_evidence();

revoke all on function private.enforce_inventory_stockout_reason_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_inventory_stockout_reason_evidence() is
  'Fail closed: stockout inventory_events require an allowlisted reason_code matching the product stockout taxonomy.';

alter table public.inventory_events
  drop constraint if exists inventory_events_stockout_reason_check;
alter table public.inventory_events
  add constraint inventory_events_stockout_reason_check check (
    event_type <> 'stockout'
    or reason_code in (
      'under_ordered',
      'unexpected_demand',
      'delivery_missed',
      'spoilage_cleared',
      'theft_loss',
      'other'
    )
  ) not valid;

comment on constraint inventory_events_stockout_reason_check on public.inventory_events is
  'Stockout rows require an allowlisted reason_code. NOT VALID skips legacy rows.';
