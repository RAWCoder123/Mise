-- MISE-005AY: pin public.supplier_order_confirmations.idempotency_key shape
-- CHECK to COLLATE "C".
--
-- public.supplier_order_confirmations still stores idempotency_key under a
-- length-only bound from the operational-backend foundation migration:
--   length(trim(idempotency_key)) between 1 and 240
-- Hosted / manager writers mint durable ASCII tokens that intentionally
-- include ISO-8601 punctuation (`.` and optional `+` timezone offset):
--   client mint := 'mgr-confirm:' || order_id || ':' || recorded_at
--     (domain confirmationClientIdForOrder; recorded_at is toISOString())
--   stored key := format('manager_confirmation:%s', client_confirmation_id)
--   fixture / foundation replay := 'supplier-confirmation-1'
-- Length-only CHECKs accept spaces, control bytes, and non-ASCII that the
-- restored C-locale path would treat differently under LC_CTYPE drift.
--
-- idempotency_key is the durable per-restaurant unique confirmation identity
-- (UNIQUE (restaurant_id, idempotency_key)). Authenticated clients hold
-- SELECT only; inserts come from SECURITY DEFINER
-- private.service_record_supplier_confirmation (and the manager-facing
-- authenticated wrapper once MISE confirmation manual lands). POSIX
-- character classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; later 005*
-- tips pinned supplier_deliveries identity (#458) and action/outcome
-- idempotency keys (#457), but left supplier_order_confirmations on
-- length-only bounds because the primary manager mint embeds ISO
-- timestamps (`.` required; `+` for offset forms).
--
-- If LC_CTYPE drifted under a length-only CHECK, dump/restore could accept
-- a confirmation identity the restored C-locale ASCII gate would refuse
-- (or the reverse), breaking confirmation replay / dedupe across restore.
--
-- Scope:
--   - Replace length-only idempotency_key CHECK with named shape CHECK:
--     idempotency_key collate "C" ~ '^[A-Za-z0-9:_+.-]{1,240}$'
-- Does NOT rewrite service_record_supplier_confirmation, activity_events
-- idempotency_key (ISO/label), restaurant_memories.dedupe_key
-- (supplier-name legacy), inventory_events identity (#375), or
-- supplier_deliveries identity (#458).
-- Timestamp after MISE-005AX (#458).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.supplier_order_confirmations'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'supplier_order_confirmations_idempotency_key_check'
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
      'alter table public.supplier_order_confirmations drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.supplier_order_confirmations
  drop constraint if exists supplier_order_confirmations_idempotency_key_check;

alter table public.supplier_order_confirmations
  add constraint supplier_order_confirmations_idempotency_key_check check (
    idempotency_key collate "C" ~ '^[A-Za-z0-9:_+.-]{1,240}$'
  );

comment on constraint supplier_order_confirmations_idempotency_key_check
  on public.supplier_order_confirmations is
  'MISE-005AY: ASCII+ISO supplier_order_confirmations.idempotency_key under COLLATE "C".';
