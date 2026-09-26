-- MISE-005H: purchase_decision_events.recommendation_unit cntrl CHECK must be
-- pinned to COLLATE "C" so append-only restore cannot reject rows the source
-- accepted.
begin;
select plan(6);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_recommendation_unit_check'
  ),
  'purchase_decision_events_recommendation_unit_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_recommendation_unit_check'
  ),
  'recommendation_unit collate "C" !~ ''[[:cntrl:]]''',
  'recommendation_unit CHECK uses COLLATE C cntrl rejection'
);

select ok(
  (
    select pg_get_constraintdef(oid) ~* 'collate "C"'
      and pg_get_constraintdef(oid) ~ '\[\[:cntrl:\]\]'
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_recommendation_unit_check'
  ),
  'recommendation_unit cntrl CHECK is pinned to COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (E'case\t' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII tab is a control under COLLATE C'
);

select is(
  ('case' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable ASCII is not a control under COLLATE C'
);

select is(
  (E'unit\u007f' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII DEL is a control under COLLATE C'
);

select * from finish();
rollback;
