-- Reject absurd future or ancient calendar dates on purchase_lines.
--
-- MISE-004C accepted any parseable ISO date for transaction_date / received_date.
-- Managers (or a poisoned ingest payload) could therefore append invoice history
-- dated years ahead or in the distant past, scrambling
-- list_purchase_line_net_by_item first/last transaction windows and any later
-- spend reads that trust those bounds.
--
-- This migration is trigger-only: it does not redeclare ingest_purchase_lines or
-- private.append_purchase_line, so it composes with open MISE-006 schema work.
-- Domain normalizePurchaseLineInput mirrors the same window before the RPC.

create or replace function private.reject_out_of_window_purchase_line_dates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Keep in lockstep with PURCHASE_LINE_DATE_MAX_LOOKBACK_DAYS /
  -- PURCHASE_LINE_DATE_FUTURE_SKEW_DAYS in services/domain/securityLimits.ts.
  max_lookback_days constant integer := 90;
  future_skew_days constant integer := 1;
begin
  if new.transaction_date > (current_date + future_skew_days) then
    raise exception 'Purchase line transaction_date is in the future'
      using errcode = '22023';
  end if;

  if new.transaction_date < (current_date - max_lookback_days) then
    raise exception 'Purchase line transaction_date is older than the allowed lookback window'
      using errcode = '22023';
  end if;

  if new.received_date is not null then
    if new.received_date > (current_date + future_skew_days) then
      raise exception 'Purchase line received_date is in the future'
        using errcode = '22023';
    end if;

    if new.received_date < (current_date - max_lookback_days) then
      raise exception 'Purchase line received_date is older than the allowed lookback window'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reject_out_of_window_purchase_line_dates on public.purchase_lines;
create trigger reject_out_of_window_purchase_line_dates
before insert on public.purchase_lines
for each row execute function private.reject_out_of_window_purchase_line_dates();

comment on function private.reject_out_of_window_purchase_line_dates() is
  'Rejects purchase_lines rows whose transaction_date or received_date fall more than one day ahead of current_date or more than 90 days behind it, so poisoned invoice dates cannot scramble append-only spend windows.';

revoke all on function private.reject_out_of_window_purchase_line_dates() from public, anon, authenticated, service_role;
