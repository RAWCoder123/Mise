-- Inventory ledger source must be a comparable slug.
--
-- Hosted `public.record_inventory_event` already requires a non-empty
-- `p_source` for owner/admin/manager. On current main, any 1–80 character
-- string can be stamped onto the append-only ledger — including spaces,
-- punctuation, mixed case, and one-off free-form phrases that cannot be
-- compared for Activity / write-path provenance analysis.
--
-- Product writers stamp lowercase snake_case sources
-- (`operator_receipt`, `supplier_delivery`, `approve_count_session`, …).
-- This migration fails closed at the database boundary for every insert
-- path (record_inventory_event, outbox, future service inserts) when
-- `source` does not match `^[a-z0-9_]{3,80}$`. The existing
-- length(trim(source)) CHECK remains; this tip adds shape.
--
-- NOT VALID CHECKs skip validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
-- Domain acceptInventoryEvent mirrors the same rejection reason.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.
-- Orthogonal to event-type source allowlists, mise/session forgery guards,
-- reason-code slug, actor_user_id, and length-only evidence-bounds tips.

create or replace function private.enforce_inventory_source_slug_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.source is null
     or new.source !~ '^[a-z0-9_]{3,80}$' then
    raise exception
      'Inventory event source must be a slug'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_events_source_slug_evidence
  on public.inventory_events;
create trigger inventory_events_source_slug_evidence
before insert on public.inventory_events
for each row execute function private.enforce_inventory_source_slug_evidence();

revoke all on function private.enforce_inventory_source_slug_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_inventory_source_slug_evidence() is
  'Fail closed: inventory_events.source must match ^[a-z0-9_]{3,80}$.';

alter table public.inventory_events
  drop constraint if exists inventory_events_source_slug_check;
alter table public.inventory_events
  add constraint inventory_events_source_slug_check check (
    source ~ '^[a-z0-9_]{3,80}$'
  ) not valid;

comment on constraint inventory_events_source_slug_check on public.inventory_events is
  'source must be a lowercase snake slug of 3–80 chars. NOT VALID skips legacy rows.';
