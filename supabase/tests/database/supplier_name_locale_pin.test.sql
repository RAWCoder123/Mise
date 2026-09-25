begin;

select plan(11);

insert into public.restaurants (id, name, cuisine_type, timezone)
values ('005b0000-0000-4000-8000-000000000001', 'Locale Pin Kitchen', 'Cafe', 'UTC');

-- MISE-005B: supplier discovery keys must be byte-identical under the cluster
-- default ctype and under COLLATE "C". Sibling proof lives on purchase_lines
-- (MISE-005A); suppliers inherit the same IMMUTABLE lower()/[[:space:]] risk.

select is(
  private.normalize_supplier_display_name(E'  Fresh\tPoultry  '),
  'Fresh Poultry',
  'display normalize collapses C-locale whitespace'
);

select is(
  private.normalize_supplier_display_name(E'Café\u00A0Supply'),
  'Café Supply',
  'display normalize folds NBSP but keeps accents and case'
);

select is(
  private.normalize_supplier_name('Fresh Poultry Supply'),
  'fresh poultry supply',
  'discovery key lowercases ASCII under COLLATE C'
);

select is(
  private.normalize_supplier_name('CAFÉ Supply'),
  'cafe supply',
  'discovery key accent-folds before lower so uppercase accents do not depend on LC_CTYPE'
);

select is(
  private.normalize_supplier_name('Jalapeño Foods'),
  'jalapeno foods',
  'discovery key folds Latin-1 accents identically to MISE-005A'
);

select is(
  private.normalize_supplier_name(E'  Café\u00A0Supply  '),
  'cafe supply',
  'discovery key is stable through NBSP and surrounding whitespace'
);

select is(
  (select count(*) from (values
     ('Fresh Poultry'), ('CAFÉ Supply'), ('Jalapeño Foods'),
     ('CRÈME FRAÎCHE CO'), (E'Café\u00A0Supply'), ('MÜLLER Dairy')
   ) fixture(sample)
   where convert_to(private.normalize_supplier_name(fixture.sample collate "C"), 'UTF8')
     is distinct from
     convert_to(private.normalize_supplier_name(fixture.sample collate "en_US.utf8"), 'UTF8')),
  0::bigint,
  'discovery key is byte-identical under C and under the database ctype'
);

select is(
  (select count(*) from (values
     (E'  Fresh\tPoultry  '), (E'Café\u00A0Supply'), ('Metro Produce')
   ) fixture(sample)
   where convert_to(private.normalize_supplier_display_name(fixture.sample collate "C"), 'UTF8')
     is distinct from
     convert_to(private.normalize_supplier_display_name(fixture.sample collate "en_US.utf8"), 'UTF8')),
  0::bigint,
  'display normalize is byte-identical under C and under the database ctype'
);

select throws_ok(
  format(
    $sql$insert into public.suppliers (restaurant_id, display_name, normalized_name)
      values (%L, E'Bad\nName', 'bad name')$sql$,
    '005b0000-0000-4000-8000-000000000001'
  ),
  '23514',
  null,
  'supplier CHECK rejects ASCII control characters in display names'
);

select lives_ok(
  format(
    $sql$insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
      values (
        '005b0000-0000-4000-8000-000000000010',
        %L,
        'Café Supply',
        private.normalize_supplier_name('Café Supply')
      )$sql$,
    '005b0000-0000-4000-8000-000000000001'
  ),
  'accented display names insert when normalized_name matches the locale-stable key'
);

select is(
  (select normalized_name from public.suppliers where id = '005b0000-0000-4000-8000-000000000010'),
  'cafe supply',
  'persisted discovery key stores the accent-folded form'
);

select * from finish();

rollback;
