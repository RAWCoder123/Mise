-- MISE-005DZ: purchase_decision_events.actor_role and
-- purchase_decision_events.decision_type CHECKs must keep the
-- exact-token allowlists and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a role or decision-type token the
-- restored C-locale gate would refuse.
begin;
select plan(24);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_actor_role_check'
  ),
  'purchase_decision_events_actor_role_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_actor_role_check'
  ),
  'actor_role in \(''owner'', ''admin'', ''manager''\)',
  'purchase_decision_events actor_role CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_actor_role_check'
  ),
  'actor_role collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'purchase_decision_events actor_role CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_decision_type_check'
  ),
  'purchase_decision_events_decision_type_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_decision_type_check'
  ),
  'decision_type in \(''approve'', ''approve_with_override'', ''dismiss'', ''undo'', ''exclude_from_learning''\)',
  'purchase_decision_events decision_type CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_decision_type_check'
  ),
  'decision_type collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'purchase_decision_events decision_type CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('owner' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token owner matches under COLLATE C'
);

select is(
  ('admin' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token admin matches under COLLATE C'
);

select is(
  ('manager' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token manager matches under COLLATE C'
);

select is(
  ('approve' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token approve matches under COLLATE C'
);

select is(
  ('approve_with_override' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token approve_with_override matches under COLLATE C'
);

select is(
  ('dismiss' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token dismiss matches under COLLATE C'
);

select is(
  ('undo' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token undo matches under COLLATE C'
);

select is(
  ('exclude_from_learning' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token exclude_from_learning matches under COLLATE C'
);

select is(
  ('own er' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced actor_role token is rejected under COLLATE C'
);

select is(
  ('approve with override' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced decision_type token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty actor_role token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty decision_type token is rejected under COLLATE C'
);

select is(
  ('owner!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated actor_role token is rejected under COLLATE C'
);

select is(
  ('approve!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated decision_type token is rejected under COLLATE C'
);

select is(
  (E'own\u00e9r' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII actor_role token is rejected under COLLATE C'
);

select is(
  (E'appr\u00f3ve' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII decision_type token is rejected under COLLATE C'
);

select is(
  ('owner' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('admin' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('manager' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted actor_role tokens match under COLLATE C'
);

select is(
  ('approve' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('approve_with_override' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('dismiss' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('undo' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('exclude_from_learning' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted decision_type tokens match under COLLATE C'
);

select * from finish();
rollback;
