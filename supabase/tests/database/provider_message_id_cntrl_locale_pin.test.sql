-- MISE-005AJ: supplier_email_deliveries.provider_message_id CHECK must reject
-- control characters under COLLATE "C" so restore cannot accept provider ids
-- the complete-send gate would refuse (and vice versa).
begin;
select plan(7);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_provider_message_id_check'
  ),
  'supplier_email_deliveries_provider_message_id_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_provider_message_id_check'
  ),
  'provider_message_id collate "C" !~ ''[[:cntrl:]]''',
  'provider_message_id CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_provider_message_id_check'
  ),
  'length\(provider_message_id\) between 1 and 512',
  'provider_message_id CHECK preserves length 1–512 bound'
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

select is(
  ('18a2b3c4d5e6f7' collate "C" ~ '[[:cntrl:]]'),
  false,
  'hex-like provider id is not a control under COLLATE C'
);

select * from finish();
rollback;
