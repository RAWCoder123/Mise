-- MISE-005AK: pin public.supplier_orders.provider_message_id cntrl half of
-- supplier_orders_email_delivery_check to COLLATE "C".
--
-- public.supplier_orders still accepts any non-null provider_message_id of
-- length 1–512 with no control-character rejection:
--   (provider_message_id is null or length(provider_message_id) between 1 and 512)
-- inside the compound supplier_orders_email_delivery_check. MISE-005AJ (#444)
-- pins the private.supplier_email_deliveries.provider_message_id CHECK with
-- COLLATE "C" cntrl rejection; MISE-005T (#428) pins the complete-send RPC
-- preflight the same way. This public mirror stayed length-only.
--
-- provider_message_id on supplier_orders is the durable Gmail provider id
-- mirrored from the private delivery row after users.messages.send accepts the
-- message. It participates in the unique (restaurant_id, email_provider,
-- provider_message_id) index and is client-visible delivery metadata. If
-- LC_CTYPE drifted under a later cntrl gate (or if the private CHECK already
-- rejects controls while this public CHECK still admits them), dump/restore
-- and private→public continuity can disagree on the same provider bytes —
-- accepting a public row the restored C-locale private gate would refuse (or
-- the reverse).
--
-- Scope:
--   - Reattach supplier_orders_email_delivery_check preserving email_provider
--     and draft/sent coherence halves, and pinning the provider_message_id
--     half to length 1–512 with COLLATE "C" !~ '[[:cntrl:]]'
-- Does NOT rewrite private.service_complete_supplier_email_send (owned by open
-- MISE-005T #428), private.supplier_email_deliveries.provider_message_id CHECK
-- (owned by open MISE-005AJ #444), claim/rfc CHECKs, or envelope metadata.
-- Timestamp after MISE-005AJ (#444).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.supplier_orders'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'supplier_orders_email_delivery_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%provider_message_id%'
          and pg_get_constraintdef(con.oid) ilike '%email_provider%'
          and pg_get_constraintdef(con.oid) ilike '%sent_at%'
          and pg_get_constraintdef(con.oid) ilike '%sent_by_user_id%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.supplier_orders drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.supplier_orders
  drop constraint if exists supplier_orders_email_delivery_check;

alter table public.supplier_orders
  add constraint supplier_orders_email_delivery_check check (
    (email_provider is null or email_provider = 'gmail')
    and (
      provider_message_id is null
      or (
        pg_catalog.length(provider_message_id) between 1 and 512
        and provider_message_id collate "C" !~ '[[:cntrl:]]'
      )
    )
    and (
      status = 'draft'
      or email_provider is null
      or (
        provider_message_id is not null
        and sent_at is not null
        and sent_by_user_id is not null
      )
    )
  );

comment on constraint supplier_orders_email_delivery_check
  on public.supplier_orders is
  'MISE-005AK: email_provider + draft/sent coherence with provider_message_id length 1–512 and ASCII C [[:cntrl:]] rejection (COLLATE "C").';
