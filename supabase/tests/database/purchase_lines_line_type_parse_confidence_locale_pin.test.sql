-- MISE-005DL: purchase_lines.line_type and
-- purchase_lines.parse_confidence CHECKs must keep the
-- exact-token allowlists and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a direction or confidence token the
-- restored C-locale gate would refuse.
begin;
select plan(21);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_line_type_check'
  ),
  'purchase_lines_line_type_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_line_type_check'
  ),
  'line_type in \(''purchase'', ''credit''\)',
  'purchase_lines line_type CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_line_type_check'
  ),
  'line_type collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'purchase_lines line_type CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_parse_confidence_check'
  ),
  'purchase_lines_parse_confidence_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_parse_confidence_check'
  ),
  'parse_confidence in \(''confirmed'', ''estimated'', ''could_not_verify''\)',
  'purchase_lines parse_confidence CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_parse_confidence_check'
  ),
  'parse_confidence collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'purchase_lines parse_confidence CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('purchase' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token purchase matches under COLLATE C'
);

select is(
  ('credit' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token credit matches under COLLATE C'
);

select is(
  ('confirmed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token confirmed matches under COLLATE C'
);

select is(
  ('estimated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token estimated matches under COLLATE C'
);

select is(
  ('could_not_verify' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token could_not_verify matches under COLLATE C'
);

select is(
  ('pur chase' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced line_type token is rejected under COLLATE C'
);

select is(
  ('could not verify' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced parse_confidence token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty line_type token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty parse_confidence token is rejected under COLLATE C'
);

select is(
  ('purchase!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated line_type token is rejected under COLLATE C'
);

select is(
  ('confirmed!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated parse_confidence token is rejected under COLLATE C'
);

select is(
  (E'purch\u00e0se' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII line_type token is rejected under COLLATE C'
);

select is(
  (E'confirm\u00e9d' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII parse_confidence token is rejected under COLLATE C'
);

select is(
  ('purchase' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('credit' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted line_type tokens match under COLLATE C'
);

select is(
  ('confirmed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('estimated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('could_not_verify' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted parse_confidence tokens match under COLLATE C'
);

select * from finish();
rollback;
