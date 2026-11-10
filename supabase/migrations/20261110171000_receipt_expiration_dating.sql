-- Optional lot use-by dating on inventory receipt evidence.
--
-- Operators capture an optional YYYY-MM-DD expires_on value when logging an
-- ad-hoc receipt. The date is stored in inventory_events.metadata as the
-- bounded key `expires_on`. It is never invented from shelf life, never
-- required, and never accepted on non-receipt event types.
--
-- A BEFORE INSERT trigger covers every write path (record_inventory_event,
-- supplier delivery receipt projection, device outbox) without wrapping the
-- RPC entry point — avoiding stack conflicts with open receive tips.
--
-- Preserves authentication, manager role gates, tenant isolation, RLS, grants,
-- and append-only inventory_events behavior.

create or replace function private.validate_inventory_event_receipt_expires_on()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expires_on text;
  year_text text;
  month_text text;
  day_text text;
  year_i integer;
  month_i integer;
  day_i integer;
  reconstructed date;
begin
  if new.metadata is null or pg_catalog.jsonb_typeof(new.metadata) <> 'object' then
    raise exception 'Inventory event evidence is incomplete' using errcode = '22023';
  end if;

  if not (new.metadata ? 'expires_on') then
    return new;
  end if;

  if new.event_type <> 'receipt' then
    raise exception 'Use-by dates can only be recorded on receipts'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(new.metadata -> 'expires_on') <> 'string' then
    raise exception 'Use-by date must be an ISO calendar date'
      using errcode = '22023';
  end if;

  expires_on := new.metadata ->> 'expires_on';

  if expires_on is null
    or expires_on <> pg_catalog.btrim(expires_on)
    or expires_on !~ '^\d{4}-\d{2}-\d{2}$'
  then
    raise exception 'Use-by date must be an ISO calendar date'
      using errcode = '22023';
  end if;

  year_text := pg_catalog.substring(expires_on from 1 for 4);
  month_text := pg_catalog.substring(expires_on from 6 for 2);
  day_text := pg_catalog.substring(expires_on from 9 for 2);
  year_i := year_text::integer;
  month_i := month_text::integer;
  day_i := day_text::integer;

  begin
    reconstructed := make_date(year_i, month_i, day_i);
  exception
    when others then
      raise exception 'Use-by date must be an ISO calendar date'
        using errcode = '22023';
  end;

  if to_char(reconstructed, 'YYYY-MM-DD') <> expires_on then
    raise exception 'Use-by date must be an ISO calendar date'
      using errcode = '22023';
  end if;

  if expires_on < '2000-01-01' or expires_on > '2100-12-31' then
    raise exception 'Use-by date is outside the supported range'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_inventory_event_receipt_expires_on on public.inventory_events;
create trigger validate_inventory_event_receipt_expires_on
before insert on public.inventory_events
for each row execute function private.validate_inventory_event_receipt_expires_on();

comment on function private.validate_inventory_event_receipt_expires_on() is
  'Rejects inventory_events rows whose metadata.expires_on is present but not a bounded YYYY-MM-DD calendar date on a receipt.';
