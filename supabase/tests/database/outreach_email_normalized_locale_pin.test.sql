-- MISE-005L: outreach email_normalized unique keys must be pinned to
-- COLLATE "C" so restore cannot reject lead/suppression rows the source accepted.
begin;
select plan(10);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.outreach_leads'::regclass
      and attname = 'email_normalized'
      and not attisdropped
  ),
  'outreach_leads.email_normalized exists'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.outreach_suppressions'::regclass
      and attname = 'email_normalized'
      and not attisdropped
  ),
  'outreach_suppressions.email_normalized exists'
);

select matches(
  (
    select pg_get_expr(adbin, adrelid)
    from pg_attrdef
    where adrelid = 'public.outreach_leads'::regclass
      and adnum = (
        select attnum
        from pg_attribute
        where attrelid = 'public.outreach_leads'::regclass
          and attname = 'email_normalized'
          and not attisdropped
      )
  ),
  'collate "C"',
  'outreach_leads.email_normalized generation uses COLLATE C'
);

select matches(
  (
    select pg_get_expr(adbin, adrelid)
    from pg_attrdef
    where adrelid = 'public.outreach_suppressions'::regclass
      and adnum = (
        select attnum
        from pg_attribute
        where attrelid = 'public.outreach_suppressions'::regclass
          and attname = 'email_normalized'
          and not attisdropped
      )
  ),
  'collate "C"',
  'outreach_suppressions.email_normalized generation uses COLLATE C'
);

select matches(
  (
    select pg_get_expr(adbin, adrelid)
    from pg_attrdef
    where adrelid = 'public.outreach_leads'::regclass
      and adnum = (
        select attnum
        from pg_attribute
        where attrelid = 'public.outreach_leads'::regclass
          and attname = 'email_normalized'
          and not attisdropped
      )
  ),
  'btrim\(email\)',
  'outreach_leads.email_normalized still btrim(email) before lower'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%email_normalized%'
  ),
  'outreach_leads keeps UNIQUE(email_normalized)'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_suppressions'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%email_normalized%'
  ),
  'outreach_suppressions keeps UNIQUE(email_normalized)'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_email_check'
  ),
  'collate "C"',
  'outreach_leads email shape CHECK uses COLLATE C'
);

select is(
  pg_catalog.lower(pg_catalog.btrim('HELLO@CORNER.EXAMPLE ' collate "C") collate "C"),
  'hello@corner.example',
  'ASCII upper mailbox folds under COLLATE C'
);

select is(
  convert_to(
    pg_catalog.lower(pg_catalog.btrim(E'\u0130stanbul@example.test' collate "C") collate "C"),
    'UTF8'
  ),
  convert_to(E'\u0130stanbul@example.test', 'UTF8'),
  'Turkish I (U+0130) is not folded under COLLATE C'
);

select * from finish();
rollback;
