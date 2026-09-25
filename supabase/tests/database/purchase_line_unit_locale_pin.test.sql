begin;

select plan(8);

-- MISE-005D: unit/pack consistency helpers must be byte-identical under the
-- cluster default ctype and under COLLATE "C". They feed ingest flags only;
-- they are not restore keys. Sibling proof lives on normalize_purchase_item_key
-- (MISE-005A).

select is(
  private.purchase_line_unit_dimension('GAL'),
  'volume',
  'unit dimension lowercases ASCII under COLLATE C'
);

select is(
  private.purchase_line_unit_dimension('  lb  '),
  'mass',
  'unit dimension trims before the locale-stable lower'
);

select is(
  private.purchase_line_pack_unit('12x32OZ'),
  'oz',
  'pack unit extracts the trailing ASCII token after COLLATE C lower'
);

select is(
  private.purchase_line_pack_unit('6/1GAL'),
  'gal',
  'pack unit reads the unit after a count/size form'
);

select is(
  private.purchase_line_unit_dimension('GÁL'),
  null,
  'accented unit tokens stay unmatched; vocabulary is ASCII-only'
);

select is(
  (select count(*) from (values
     ('GAL'), ('lb'), ('  Litres  '), ('OZ'), ('GÁL'), ('QUART')
   ) fixture(sample)
   where convert_to(coalesce(private.purchase_line_unit_dimension(fixture.sample collate "C"), '<null>'), 'UTF8')
     is distinct from
     convert_to(coalesce(private.purchase_line_unit_dimension(fixture.sample collate "en_US.utf8"), '<null>'), 'UTF8')),
  0::bigint,
  'unit dimension is byte-identical under C and under the database ctype'
);

select is(
  (select count(*) from (values
     ('12x32OZ'), ('6/1GAL'), ('40 LB'), ('5kg'), ('12x32K')
   ) fixture(sample)
   where convert_to(coalesce(private.purchase_line_pack_unit(fixture.sample collate "C"), '<null>'), 'UTF8')
     is distinct from
     convert_to(coalesce(private.purchase_line_pack_unit(fixture.sample collate "en_US.utf8"), '<null>'), 'UTF8')),
  0::bigint,
  'pack unit is byte-identical under C and under the database ctype'
);

select is(
  private.purchase_line_pack_unit('12x32K'),
  null,
  'Unicode Kelvin sign is not an ASCII pack unit under COLLATE C'
);

select * from finish();
rollback;
