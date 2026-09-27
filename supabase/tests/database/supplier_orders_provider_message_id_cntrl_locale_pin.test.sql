-- MISE-005AK: supplier_orders_email_delivery_check must reject control
-- characters on provider_message_id under COLLATE "C" so the public mirror
-- cannot accept provider ids the private delivery CHECK / complete-send gate
-- would refuse (and vice versa).
begin;
select plan(8);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_email_delivery_check'
  ),
  'supplier_orders_email_delivery_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_email_delivery_check'
  ),
  'provider_message_id collate "C" !~ ''[[:cntrl:]]''',
  'provider_message_id half uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_email_delivery_check'
  ),
  'length\(provider_message_id\) between 1 and 512',
  'provider_message_id half preserves length 1–512 bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_email_delivery_check'
  ),
  'email_provider is null or email_provider = ''gmail''',
  'email_provider half preserved'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_email_delivery_check'
  ),
  'sent_at is not null',
  'draft/sent coherence half preserved'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (E'gmail-msg\t123' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII tab is a control under COLLATE C'
);

select is(
  ('gmail-msg-123' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable ASCII provider id is not a control under COLLATE C'
);

select is(
  (E'gmail-msg\u007f123' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII DEL is a control under COLLATE C'
);

select * from finish();
rollback;
