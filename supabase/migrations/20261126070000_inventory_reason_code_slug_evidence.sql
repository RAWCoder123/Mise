-- Inventory ledger reason_code must be a comparable slug when present.
--
-- Hosted `public.record_inventory_event` already accepts free-text
-- `p_reason_code` for owner/admin/manager. On current main, any non-empty
-- string can be stamped onto the append-only ledger — including spaces,
-- punctuation, mixed case, and one-off free-form phrases that cannot be
-- compared for Activity / reason-code analysis.
--
-- Operational mode changes already require the same slug shape
-- (`^[a-z0-9_]{3,64}$`). Product writers that stamp inventory reasons use
-- lowercase snake_case codes of that form. This migration fails closed at
-- the database boundary for every insert path (record_inventory_event,
-- outbox, future service inserts) when a reason_code is present and does
-- not match. Null remains allowed so event types that omit a reason stay
-- unconstrained.
--
-- NOT VALID CHECKs skip validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
-- Domain acceptInventoryEvent mirrors the same rejection reason.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.
-- Orthogonal to event-type reason allowlists, other-reason notes, and the
-- length-only evidence-bounds tip (#1261).

create or replace function private.enforce_inventory_reason_code_slug_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.reason_code is not null
     and new.reason_code !~ '^[a-z0-9_]{3,64}$' then
    raise exception
      'Inventory event reason code must be a slug'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_events_reason_code_slug_evidence
  on public.inventory_events;
create trigger inventory_events_reason_code_slug_evidence
before insert on public.inventory_events
for each row execute function private.enforce_inventory_reason_code_slug_evidence();

revoke all on function private.enforce_inventory_reason_code_slug_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_inventory_reason_code_slug_evidence() is
  'Fail closed: when inventory_events.reason_code is present it must match ^[a-z0-9_]{3,64}$.';

alter table public.inventory_events
  drop constraint if exists inventory_events_reason_code_slug_check;
alter table public.inventory_events
  add constraint inventory_events_reason_code_slug_check check (
    reason_code is null
    or reason_code ~ '^[a-z0-9_]{3,64}$'
  ) not valid;

comment on constraint inventory_events_reason_code_slug_check on public.inventory_events is
  'When present, reason_code must be a lowercase snake slug of 3–64 chars. NOT VALID skips legacy rows.';
