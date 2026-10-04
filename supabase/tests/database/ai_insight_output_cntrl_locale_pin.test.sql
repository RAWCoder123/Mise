-- MISE-005HJ: private.structured_ai_insight_output_is_valid must reject
-- ASCII controls under COLLATE "C" on structured insight text fields and
-- compare risk_level / affected_workflow allowlists under COLLATE "C" so
-- dump/restore cannot accept output bytes the restored C-locale gate would
-- refuse. Sibling schema_version / provenance CHECKs stay on separate tips.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'structured_ai_insight_output_is_valid'
  ),
  'structured_ai_insight_output_is_valid exists'
);

select matches(
  pg_get_functiondef(
    'private.structured_ai_insight_output_is_valid(jsonb)'::regprocedure
  ),
  'title_text collate "C" ~ ''[[:cntrl:]]''',
  'insight title rejects controls under COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.structured_ai_insight_output_is_valid(jsonb)'::regprocedure
  ),
  'summary_text collate "C" ~ ''[[:cntrl:]]''',
  'insight summary rejects controls under COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.structured_ai_insight_output_is_valid(jsonb)'::regprocedure
  ),
  'action_text collate "C" ~ ''[[:cntrl:]]''',
  'insight recommended_action rejects controls under COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.structured_ai_insight_output_is_valid(jsonb)'::regprocedure
  ),
  'evidence_text collate "C" ~ ''[[:cntrl:]]''',
  'insight evidence rejects controls under COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.structured_ai_insight_output_is_valid(jsonb)'::regprocedure
  ),
  'risk_text collate "C" not in',
  'risk_level allowlist stays pinned under COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.structured_ai_insight_output_is_valid(jsonb)'::regprocedure
  ),
  'workflow_text collate "C" not in',
  'affected_workflow allowlist stays pinned under COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Low bun stock' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable insight title is accepted under COLLATE C'
);

select is(
  (E'Low\tbun' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in insight title is rejected under COLLATE C'
);

select is(
  (E'Low\nbun' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in insight title is rejected under COLLATE C'
);

select is(
  (E'count\u007fdrift' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in insight evidence is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Low bun stock' collate "C" !~ '[[:cntrl:]]')
    and (E'Low\tbun' collate "C" ~ '[[:cntrl:]]')
    and (E'Low\nbun' collate "C" ~ '[[:cntrl:]]')
    and (E'count\u007fdrift' collate "C" ~ '[[:cntrl:]]'),
  true,
  'insight text control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Low\tbun'),
      ('Low bun stock'),
      (E'Low\nbun'),
      (E'count\u007fdrift')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '[[:cntrl:]]')
  ),
  0::bigint,
  'ASCII control detector is identical under C and under the database ctype'
);

select is(
  private.structured_ai_insight_output_is_valid(
    jsonb_build_object(
      'title', 'Low bun stock',
      'summary', 'Verified counts show buns below reorder.',
      'recommended_action', 'Draft a bakery order before dinner.',
      'risk_level', 'medium',
      'confidence', 0.8,
      'affected_workflow', 'inventory',
      'evidence', jsonb_build_array('count session 2026-10-04')
    )
  ),
  true,
  'valid structured insight output is accepted'
);

select is(
  private.structured_ai_insight_output_is_valid(
    jsonb_build_object(
      'title', E'Low\tbun stock',
      'summary', 'Verified counts show buns below reorder.',
      'recommended_action', 'Draft a bakery order before dinner.',
      'risk_level', 'medium',
      'confidence', 0.8,
      'affected_workflow', 'inventory',
      'evidence', jsonb_build_array('count session 2026-10-04')
    )
  ),
  false,
  'control-bearing insight title is rejected by the validator'
);

select * from finish();
rollback;
