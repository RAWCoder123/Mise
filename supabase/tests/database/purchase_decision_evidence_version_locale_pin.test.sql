-- MISE-005BV: purchase_decision_events.evidence_version CHECK must keep
-- the exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a contract identity the restored C-locale
-- gate would refuse.
begin;
select plan(8);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_evidence_version_check'
  ),
  'purchase_decision_events_evidence_version_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_evidence_version_check'
  ),
  'evidence_version = ''mise\.purchase_decision\.v1''',
  'evidence_version CHECK keeps exact-token allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_evidence_version_check'
  ),
  'evidence_version collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'evidence_version CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('mise.purchase_decision.v1' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer evidence_version matches under COLLATE C'
);

select is(
  ('mise purchase decision v1' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced evidence_version is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty evidence_version token is rejected under COLLATE C'
);

select is(
  ('mise.purchase_decision.v1!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated evidence_version is rejected under COLLATE C'
);

select is(
  (E'mise.purchase_decision.\u00e9v1' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII evidence_version is rejected under COLLATE C'
);

select * from finish();
rollback;
