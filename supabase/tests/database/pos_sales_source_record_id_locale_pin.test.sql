-- MISE-005BL: pos_sales.source_record_id CHECK must reject control characters
-- under COLLATE "C" so restore cannot accept sale identities the prepare gate
-- would refuse (and vice versa).
begin;
select plan(7);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_source_record_id_check'
  ),
  'pos_sales_source_record_id_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_source_record_id_check'
  ),
  'source_record_id collate "C" !~ ''[[:cntrl:]]''',
  'source_record_id CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_source_record_id_check'
  ),
  'length\(trim\(source_record_id\)\) between 1 and 200',
  'source_record_id CHECK preserves length(trim) 1–200 bound'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (E'square-order\t123' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII tab is a control under COLLATE C'
);

select is(
  ('square-order-123' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable ASCII sale identity is not a control under COLLATE C'
);

select is(
  (E'square-order\u007f123' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII DEL is a control under COLLATE C'
);

select is(
  ('xM4Y5Z6A7B8C9D0E1F2G3H4I5J6K7L8' collate "C" ~ '[[:cntrl:]]'),
  false,
  'Square-like sale identity is not a control under COLLATE C'
);

select * from finish();
rollback;
