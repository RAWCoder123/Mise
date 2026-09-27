-- MISE-005AJ: pin supplier_email_deliveries.provider_message_id cntrl CHECK
-- to COLLATE "C".
--
-- private.supplier_email_deliveries.provider_message_id still accepts any
-- non-null text of length 1–512:
--   provider_message_id is null or length(provider_message_id) between 1 and 512
-- with no control-character rejection. MISE-005T (#428) pins the complete-send
-- RPC preflight to
--   p_provider_message_id collate "C" ~ '[[:cntrl:]]'
-- but intentionally does not reattach this table CHECK. MISE-005J pinned the
-- sibling rfc_message_id CHECK with COLLATE "C" cntrl rejection; provider_message_id
-- remained length-only.
--
-- provider_message_id is the durable Gmail provider id persisted only after
-- users.messages.send accepts the message. It is unique when present and is
-- the restore/audit key for completed supplier sends. If LC_CTYPE drifted under
-- a later cntrl gate (or if complete-send already rejects controls while the
-- CHECK still admits them), dump/restore and claim→complete continuity can
-- disagree on the same provider bytes — accepting a row the restored C-locale
-- gate would refuse (or the reverse).
--
-- Scope:
--   - Reattach supplier_email_deliveries_provider_message_id_check with
--     length 1–512 and COLLATE "C" !~ '[[:cntrl:]]'
-- Does NOT rewrite private.service_complete_supplier_email_send (owned by open
-- MISE-005T #428), claim/rfc CHECKs (MISE-005J/005S), envelope metadata
-- (MISE-005J/005P), or public.supplier_orders_email_delivery_check (compound
-- length-only sibling; deferred).
-- Timestamp after MISE-005AI (#443).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'private.supplier_email_deliveries'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'supplier_email_deliveries_provider_message_id_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%provider_message_id%'
          and pg_get_constraintdef(con.oid) ilike '%length%provider_message_id%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and pg_get_constraintdef(con.oid) not ilike '%provider_accepted_at%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table private.supplier_email_deliveries drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table private.supplier_email_deliveries
  drop constraint if exists supplier_email_deliveries_provider_message_id_check;

alter table private.supplier_email_deliveries
  add constraint supplier_email_deliveries_provider_message_id_check check (
    provider_message_id is null
    or (
      pg_catalog.length(provider_message_id) between 1 and 512
      and provider_message_id collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint supplier_email_deliveries_provider_message_id_check
  on private.supplier_email_deliveries is
  'MISE-005AJ: optional provider_message_id length 1–512 with ASCII C [[:cntrl:]] rejection (COLLATE "C").';
