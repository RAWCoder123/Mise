-- MISE-005HY: public.outreach_agent_runs.error_summary CHECK must keep
-- nullability, bound length(trim) when present, and pin multiline-aware
-- ASCII control rejection under COLLATE "C" so dump/restore cannot accept
-- error_summary bytes the restored C-locale gate would refuse, while still
-- allowing LF/TAB/CR (free-form joined run-error fragments).
begin;
select plan(15);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_agent_runs'::regclass
      and conname = 'outreach_agent_runs_error_summary_check'
  ),
  'outreach_agent_runs_error_summary_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_agent_runs'::regclass
      and conname = 'outreach_agent_runs_error_summary_check'
  ),
  'error_summary is null',
  'outreach_agent_runs error_summary CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_agent_runs'::regclass
      and conname = 'outreach_agent_runs_error_summary_check'
  ),
  'length\(trim\(error_summary\)\) between 1 and 1000',
  'outreach_agent_runs error_summary CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_agent_runs'::regclass
      and conname = 'outreach_agent_runs_error_summary_check'
  ),
  'error_summary collate "C" !~',
  'outreach_agent_runs error_summary CHECK uses COLLATE C control rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Campaign blocked: daily send limit reached.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable outreach agent error_summary is accepted under COLLATE C'
);

select is(
  (E'Campaign blocked:\ndaily send limit reached.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in outreach agent error_summary is accepted under multiline-aware gate'
);

select is(
  (E'Campaign blocked:\tdaily send limit reached.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in outreach agent error_summary is accepted under multiline-aware gate'
);

select is(
  (E'Campaign blocked:\rdaily send limit reached.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in outreach agent error_summary is accepted under multiline-aware gate'
);

select is(
  (E'Campaign blocked:\x08daily send limit reached.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in outreach agent error_summary is rejected under COLLATE C'
);

select is(
  (E'Campaign blocked:\x0bdaily send limit reached.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in outreach agent error_summary is rejected under COLLATE C'
);

select is(
  (E'Campaign blocked:\u007fdaily send limit reached.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in outreach agent error_summary is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe multiline controls under COLLATE C'
);

select is(
  ('Campaign blocked: daily send limit reached.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Campaign blocked:\ndaily send limit reached.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Campaign blocked:\x0bdaily send limit reached.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Campaign blocked:\u007fdaily send limit reached.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'outreach agent error_summary multiline control detector matches supplier-send allowlist'
);

select is(
  (
    select count(*)
    from (values
      (E'Campaign blocked:\tdaily send limit reached.'),
      ('Campaign blocked: daily send limit reached.'),
      (E'Campaign blocked:\ndaily send limit reached.'),
      (E'Campaign blocked:\rdaily send limit reached.'),
      (E'Campaign blocked:\x0bdaily send limit reached.'),
      (E'Campaign blocked:\u007fdaily send limit reached.')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
  ),
  0::bigint,
  'multiline ASCII control detector is identical under C and under the database ctype'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_agent_runs'::regclass
      and conname = 'outreach_agent_runs_error_summary_check'
  ),
  'between 1 and 1000',
  'outreach_agent_runs error_summary CHECK keeps length window'
);

select * from finish();
rollback;
