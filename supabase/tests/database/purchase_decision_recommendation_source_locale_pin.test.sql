-- MISE-005EA: purchase_decision_events.recommendation_source CHECK must keep
-- the exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a recommendation_source token the restored
-- C-locale gate would refuse.
begin;
select plan(10);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_recommendation_source_check'
  ),
  'purchase_decision_events_recommendation_source_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_recommendation_source_check'
  ),
  'recommendation_source in \(''mise_rules'', ''legacy_client''\)',
  'purchase_decision_events recommendation_source CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_recommendation_source_check'
  ),
  'recommendation_source collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'purchase_decision_events recommendation_source CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('mise_rules' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token mise_rules matches under COLLATE C'
);

select is(
  ('legacy_client' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token legacy_client matches under COLLATE C'
);

select is(
  ('mise rules' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced recommendation_source token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty recommendation_source token is rejected under COLLATE C'
);

select is(
  ('mise_rules!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated recommendation_source token is rejected under COLLATE C'
);

select is(
  (E'mise_rul\u00e9s' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII recommendation_source token is rejected under COLLATE C'
);

select is(
  ('mise_rules' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('legacy_client' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted recommendation_source tokens match under COLLATE C'
);

select * from finish();
rollback;
