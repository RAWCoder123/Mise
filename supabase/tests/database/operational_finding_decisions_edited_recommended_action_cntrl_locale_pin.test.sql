-- MISE-005HE: public.operational_finding_decisions.edited_recommended_action
-- CHECK must keep nullability, bound length(trim) when present, and pin
-- ASCII control rejection under COLLATE "C" so dump/restore cannot accept
-- edited recommended-action bytes the restored C-locale gate would refuse.
-- Sibling edit-shape CHECK / original_recommended_action / finding_id /
-- decision_type stay on separate constraints.
begin;
select plan(15);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and conname =
        'operational_finding_decisions_edited_recommended_action_check'
  ),
  'operational_finding_decisions_edited_recommended_action_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and conname =
        'operational_finding_decisions_edited_recommended_action_check'
  ),
  'edited_recommended_action is null',
  'finding edited_recommended_action CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and conname =
        'operational_finding_decisions_edited_recommended_action_check'
  ),
  'length\(trim\(edited_recommended_action\)\) between 1 and 320',
  'finding edited_recommended_action CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and conname =
        'operational_finding_decisions_edited_recommended_action_check'
  ),
  'edited_recommended_action collate "C" !~ ''[[:cntrl:]]''',
  'finding edited_recommended_action CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and contype = 'c'
      and conname = 'operational_finding_decision_edit_check'
  ),
  'operational_finding_decision_edit_check remains attached'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and contype = 'c'
      and conname =
        'operational_finding_decisions_edited_recommended_action_check'
    limit 1
  ) ilike '%decision_type%',
  false,
  'edited_recommended_action CHECK stays dedicated (excludes edit-shape)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Review 30 lb after recounting.' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable finding edited_recommended_action is accepted under COLLATE C'
);

select is(
  (E'Review\t30 lb after recounting.' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in finding edited_recommended_action is rejected under COLLATE C'
);

select is(
  (E'Review\n30 lb after recounting.' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in finding edited_recommended_action is rejected under COLLATE C'
);

select is(
  (E'Review\u000030 lb after recounting.' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in finding edited_recommended_action is rejected under COLLATE C'
);

select is(
  (E'Review\u007f30 lb after recounting.' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in finding edited_recommended_action is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Review 30 lb after recounting.' collate "C" !~ '[[:cntrl:]]')
    and (E'Review\t30 lb after recounting.' collate "C" ~ '[[:cntrl:]]')
    and (E'Review\n30 lb after recounting.' collate "C" ~ '[[:cntrl:]]')
    and (E'Review\u007f30 lb after recounting.' collate "C" ~ '[[:cntrl:]]'),
  true,
  'finding edited_recommended_action control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Review\t30 lb after recounting.'),
      ('Review 30 lb after recounting.'),
      (E'Review\n30 lb after recounting.'),
      (E'Review\u007f30 lb after recounting.')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '[[:cntrl:]]')
  ),
  0::bigint,
  'ASCII control detector is identical under C and under the database ctype'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and conname =
        'operational_finding_decisions_edited_recommended_action_check'
  ),
  'between 1 and 320',
  'finding edited_recommended_action CHECK keeps original length window'
);

select * from finish();
rollback;
