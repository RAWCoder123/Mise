-- MISE-005J: supplier-send / Gmail delivery envelope cntrl CHECKs must be
-- pinned to COLLATE "C" so restore cannot reject delivery claim rows the
-- source accepted.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.gmail_credentials'::regclass
      and conname = 'gmail_credentials_sender_email_check'
  ),
  'gmail_credentials_sender_email_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_rfc_message_id_check'
  ),
  'supplier_email_deliveries_rfc_message_id_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_mise_003c_metadata_check'
  ),
  'supplier_email_deliveries_mise_003c_metadata_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.gmail_credentials'::regclass
      and conname = 'gmail_credentials_sender_email_check'
  ),
  'sender_email collate "C" !~ ''[[:cntrl:]]''',
  'gmail_credentials.sender_email CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_rfc_message_id_check'
  ),
  'rfc_message_id collate "C" !~ ''[[:cntrl:]]''',
  'supplier_email_deliveries.rfc_message_id CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_mise_003c_metadata_check'
  ),
  'claimed_from collate "C" !~ ''[[:cntrl:]]''',
  'claimed_from CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_mise_003c_metadata_check'
  ),
  'claimed_to collate "C" !~ ''[[:cntrl:]]''',
  'claimed_to CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_mise_003c_metadata_check'
  ),
  'claimed_subject collate "C" !~ ''[[:cntrl:]]''',
  'claimed_subject CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (E'chef\t@mise.example' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII tab is a control under COLLATE C'
);

select is(
  ('chef@mise.example' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable ASCII is not a control under COLLATE C'
);

select is(
  (E'<msg\u007f@mise.example>' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII DEL is a control under COLLATE C'
);

select is(
  ('Order for Friday' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable subject text is not a control under COLLATE C'
);

select * from finish();
rollback;
