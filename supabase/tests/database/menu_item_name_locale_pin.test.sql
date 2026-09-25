begin;

select plan(9);

insert into public.restaurants (id, name, cuisine_type)
values ('005c0000-0000-4000-8000-000000000001', 'Menu Locale Kitchen', 'Cafe');

-- MISE-005C: menu item discovery keys must be byte-identical under the cluster
-- default ctype and under COLLATE "C". Sibling proof lives on purchase_lines
-- (MISE-005A) and suppliers (MISE-005B).

select is(
  private.normalize_menu_item_name('  Margherita Pizza  '),
  'margherita pizza',
  'menu normalize trims and lowercases ASCII under COLLATE C'
);

select is(
  private.normalize_menu_item_name('CAFÉ LATTE'),
  'cafe latte',
  'menu normalize accent-folds before lower so uppercase accents do not depend on LC_CTYPE'
);

select is(
  private.normalize_menu_item_name('Cafe Latte'),
  'cafe latte',
  'accented and plain Cafe share one discovery key after fold'
);

select is(
  private.normalize_menu_item_name('Jalapeño Burger'),
  private.normalize_menu_item_name('JALAPEÑO BURGER'),
  'mixed-case accented names share one locale-stable key'
);

select is(
  (select count(*) from (values
     ('Margherita Pizza'), ('CAFÉ LATTE'), ('Jalapeño Burger'),
     ('CRÈME BRÛLÉE'), ('JALAPEÑO BURGER'), ('MÜLLER Schnitzel')
   ) fixture(sample)
   where convert_to(private.normalize_menu_item_name(fixture.sample collate "C"), 'UTF8')
     is distinct from
     convert_to(private.normalize_menu_item_name(fixture.sample collate "en_US.utf8"), 'UTF8')),
  0::bigint,
  'menu discovery key is byte-identical under C and under the database ctype'
);

select lives_ok(
  format(
    $sql$insert into public.menu_items (id, restaurant_id, name, active)
      values (
        '005c0000-0000-4000-8000-000000000010',
        %L,
        'Café Latte',
        true
      )$sql$,
    '005c0000-0000-4000-8000-000000000001'
  ),
  'accented menu names insert under the locale-stable unique index'
);

select throws_ok(
  format(
    $sql$insert into public.menu_items (restaurant_id, name, active)
      values (%L, 'CAFÉ LATTE', true)$sql$,
    '005c0000-0000-4000-8000-000000000001'
  ),
  '23505',
  null,
  'unique index rejects case/accent duplicates of a menu name'
);

select throws_ok(
  format(
    $sql$insert into public.menu_items (restaurant_id, name, active)
      values (%L, 'Cafe Latte', true)$sql$,
    '005c0000-0000-4000-8000-000000000001'
  ),
  '23505',
  null,
  'unique index rejects Cafe when Café is already present after accent fold'
);

select is(
  (select indexdef
     from pg_indexes
    where schemaname = 'public'
      and indexname = 'menu_items_restaurant_normalized_name_key'),
  'CREATE UNIQUE INDEX menu_items_restaurant_normalized_name_key ON public.menu_items USING btree (restaurant_id, private.normalize_menu_item_name(name))',
  'unique index expression uses normalize_menu_item_name rather than bare lower(trim(name))'
);

select * from finish();

rollback;
