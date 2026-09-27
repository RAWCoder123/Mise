-- MISE-005AX: pin public.supplier_deliveries.client_delivery_id and
-- public.supplier_deliveries.idempotency_key shape CHECKs to COLLATE "C".
--
-- public.supplier_deliveries still stores both identity columns under
-- length-only bounds from the operational-backend foundation migration:
--   length(trim(client_delivery_id)) between 1 and 200
--   length(trim(idempotency_key)) between 1 and 240
-- Hosted / demo writers mint durable ASCII tokens that intentionally include
-- ISO-8601 punctuation (`.` and optional `+` timezone offset):
--   client_delivery_id := 'supplier_delivery:' || order_id || ':' || received_at
--     (domain deliveryClientIdForOrder; received_at is toISOString())
--   client_delivery_id demo fixtures := 'demo-delivery-pantry-1' etc.
--   client_delivery_id pgTAP fixtures := 'operational-delivery-1'
--   idempotency_key := format('supplier_delivery:%s', client_delivery_id)
-- Length-only CHECKs accept spaces, control bytes, and non-ASCII that the
-- restored C-locale path would treat differently under LC_CTYPE drift.
--
-- Both columns are durable per-restaurant unique identity keys
-- (UNIQUE (restaurant_id, client_delivery_id) and
-- UNIQUE (restaurant_id, idempotency_key)). Authenticated clients hold
-- SELECT only; inserts come from SECURITY DEFINER record_supplier_delivery.
-- POSIX character classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; later 005*
-- tips pinned mise_actions / action_outcomes idempotency_key (#457) and
-- operational_issues.dedupe_key (#456), but left supplier_deliveries
-- identity columns on length-only bounds because the primary mint embeds
-- ISO timestamps (`.` required; `+` for offset forms).
--
-- If LC_CTYPE drifted under a length-only CHECK, dump/restore could accept
-- a delivery identity the restored C-locale ASCII gate would refuse (or the
-- reverse), breaking delivery replay / dedupe across restore.
--
-- Scope:
--   - Replace length-only client_delivery_id CHECK with named shape CHECK:
--     client_delivery_id collate "C" ~ '^[A-Za-z0-9:_+.-]{1,200}$'
--   - Replace length-only idempotency_key CHECK with named shape CHECK:
--     idempotency_key collate "C" ~ '^[A-Za-z0-9:_+.-]{1,240}$'
-- Does NOT rewrite record_supplier_delivery, inventory_events identity
-- (#375), activity_events.idempotency_key (ISO/label), or
-- restaurant_memories.dedupe_key (supplier-name legacy).
-- Timestamp after MISE-005AW (#457).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.supplier_deliveries'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'supplier_deliveries_client_delivery_id_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%client_delivery_id%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(trim(client_delivery_id))%'
            or pg_get_constraintdef(con.oid) ilike '%length(client_delivery_id)%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9:_+.-]{1,200}$%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.supplier_deliveries drop constraint %I',
      constraint_name
    );
  end loop;

  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.supplier_deliveries'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'supplier_deliveries_idempotency_key_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%idempotency_key%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(trim(idempotency_key))%'
            or pg_get_constraintdef(con.oid) ilike '%length(idempotency_key)%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9:_+.-]{1,240}$%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.supplier_deliveries drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.supplier_deliveries
  drop constraint if exists supplier_deliveries_client_delivery_id_check;

alter table public.supplier_deliveries
  drop constraint if exists supplier_deliveries_idempotency_key_check;

alter table public.supplier_deliveries
  add constraint supplier_deliveries_client_delivery_id_check check (
    client_delivery_id collate "C" ~ '^[A-Za-z0-9:_+.-]{1,200}$'
  );

alter table public.supplier_deliveries
  add constraint supplier_deliveries_idempotency_key_check check (
    idempotency_key collate "C" ~ '^[A-Za-z0-9:_+.-]{1,240}$'
  );

comment on constraint supplier_deliveries_client_delivery_id_check
  on public.supplier_deliveries is
  'MISE-005AX: ASCII+ISO supplier_deliveries.client_delivery_id under COLLATE "C".';

comment on constraint supplier_deliveries_idempotency_key_check
  on public.supplier_deliveries is
  'MISE-005AX: ASCII+ISO supplier_deliveries.idempotency_key under COLLATE "C".';
