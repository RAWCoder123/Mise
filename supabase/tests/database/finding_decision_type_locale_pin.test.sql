-- MISE-005DY: public.operational_finding_decisions.decision_type CHECK
-- must keep the exact-token allowlist and pin ASCII shape under COLLATE "C"
-- so dump/restore cannot accept a finding-decision vocabulary token the
-- restored C-locale gate would refuse.
begin;
select plan(11);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and conname = 'operational_finding_decisions_decision_type_check'
  ),
  'operational_finding_decisions_decision_type_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and conname = 'operational_finding_decisions_decision_type_check'
  ),
  'decision_type in \(''approved'', ''edited'', ''dismissed''\)',
  'operational_finding_decisions decision_type CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and conname = 'operational_finding_decisions_decision_type_check'
  ),
  'decision_type collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'operational_finding_decisions decision_type CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('approved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token approved matches under COLLATE C'
);

select is(
  ('edited' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token edited matches under COLLATE C'
);

select is(
  ('dismissed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token dismissed matches under COLLATE C'
);

select is(
  ('approve d' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced decision_type token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty decision_type token is rejected under COLLATE C'
);

select is(
  ('approved!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated decision_type token is rejected under COLLATE C'
);

select is(
  (E'approv\u00e9d' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII decision_type token is rejected under COLLATE C'
);

select is(
  ('approved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('edited' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('dismissed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted decision_type tokens match under COLLATE C'
);

select * from finish();
rollback;
