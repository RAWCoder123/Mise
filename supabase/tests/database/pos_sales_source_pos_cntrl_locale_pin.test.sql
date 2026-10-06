-- MISE-005IO: pos_sales.source_pos CHECK must reject control characters
-- under COLLATE "C" and bound length so restore cannot accept sale-identity
-- provider labels sibling gates would refuse (and vice versa).
begin;
select plan(8);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_source_pos_check'
  ),
  'pos_sales_source_pos_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_source_pos_check'
  ),
  'source_pos collate "C" !~ ''[[:cntrl:]]''',
  'source_pos CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_source_pos_check'
  ),
  'length\(btrim\(source_pos\)\) between 1 and 80',
  'source_pos CHECK pins length(btrim) 1–80 bound'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (E'Square\tPOS' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII tab is a control under COLLATE C'
);

select is(
  ('Square' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable ASCII Square label is not a control under COLLATE C'
);

select is(
  (E'Demo\u007fPOS' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII DEL is a control under COLLATE C'
);

select is(
  ('Manual CSV Upload' collate "C" ~ '[[:cntrl:]]'),
  false,
  'Manual CSV Upload label is not a control under COLLATE C'
);

select is(
  ('Demo POS' collate "C" ~ '[[:cntrl:]]'),
  false,
  'Demo POS label is not a control under COLLATE C'
);

select * from finish();
rollback;
