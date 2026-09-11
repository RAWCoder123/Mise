-- Usage and adjustment ledger events must carry allowlisted reason codes and a
-- non-empty operator note.
--
-- Hosted `record_inventory_event` already accepts usage/adjustment for
-- owner/admin/manager. Projection subtracts usage and applies adjustments as
-- signed deltas. Without bounded evidence, a manager JWT can rewrite on-hand
-- under those semantics with no comparable audit taxonomy.
--
-- Product writers that surface these types in UI stamp:
--   usage reason: prep | staff_meal | tasting | training | other
--   adjustment reason: found | lost | recount_delta | other
--   metadata.note: required non-empty trimmed text
--
-- This migration fails closed at the database boundary for every insert path
-- (record_inventory_event, future service inserts, outbox). Receipt, count,
-- waste, stockout, transfer, and correction keep their own evidence rules.
--
-- NOT VALID CHECKs skip validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
-- Domain acceptInventoryEvent mirrors the same rejection reasons.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.

create or replace function private.enforce_inventory_usage_adjustment_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_reason text := nullif(pg_catalog.btrim(coalesce(new.reason_code, '')), '');
  note_text text := nullif(
    pg_catalog.btrim(coalesce(new.metadata ->> 'note', '')),
    ''
  );
begin
  if new.event_type = 'usage' then
    if normalized_reason is null then
      raise exception 'Inventory usage events require a reason code'
        using errcode = '22023';
    end if;
    if normalized_reason not in (
      'prep', 'staff_meal', 'tasting', 'training', 'other'
    ) then
      raise exception 'Inventory usage reason code is not allowed'
        using errcode = '22023';
    end if;
    if note_text is null then
      raise exception 'Inventory usage events require a note'
        using errcode = '22023';
    end if;
  elsif new.event_type = 'adjustment' then
    if normalized_reason is null then
      raise exception 'Inventory adjustment events require a reason code'
        using errcode = '22023';
    end if;
    if normalized_reason not in (
      'found', 'lost', 'recount_delta', 'other'
    ) then
      raise exception 'Inventory adjustment reason code is not allowed'
        using errcode = '22023';
    end if;
    if note_text is null then
      raise exception 'Inventory adjustment events require a note'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_inventory_usage_adjustment_evidence()
  from public, anon, authenticated, service_role;

drop trigger if exists inventory_events_usage_adjustment_evidence
  on public.inventory_events;

create trigger inventory_events_usage_adjustment_evidence
  before insert on public.inventory_events
  for each row
  execute function private.enforce_inventory_usage_adjustment_evidence();

comment on function private.enforce_inventory_usage_adjustment_evidence() is
  'Fail closed: usage/adjustment inventory_events require an allowlisted reason_code and non-empty metadata.note.';

alter table public.inventory_events
  drop constraint if exists inventory_events_usage_reason_check;

alter table public.inventory_events
  add constraint inventory_events_usage_reason_check check (
    event_type <> 'usage'
    or reason_code in ('prep', 'staff_meal', 'tasting', 'training', 'other')
  ) not valid;

comment on constraint inventory_events_usage_reason_check on public.inventory_events is
  'Usage rows require an allowlisted reason_code. NOT VALID skips legacy rows.';

alter table public.inventory_events
  drop constraint if exists inventory_events_adjustment_reason_check;

alter table public.inventory_events
  add constraint inventory_events_adjustment_reason_check check (
    event_type <> 'adjustment'
    or reason_code in ('found', 'lost', 'recount_delta', 'other')
  ) not valid;

comment on constraint inventory_events_adjustment_reason_check on public.inventory_events is
  'Adjustment rows require an allowlisted reason_code. NOT VALID skips legacy rows.';
