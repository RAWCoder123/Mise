-- MISE-005E jsonb_bound_octet_length:
-- jsonb CHECK bounds must use octet_length(...::text), not pg_column_size.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'operational_issues_evidence_bound_check'
      and conrelid = 'public.operational_issues'::regclass
  ),
  'operational_issues evidence bound constraint exists'
);

select ok(
  (
    select count(*) = 0
    from (
      values
        ('public.operational_issues'::regclass, 'operational_issues_evidence_bound_check'),
        ('public.mise_actions'::regclass, 'mise_actions_evidence_bound_check'),
        ('public.mise_actions'::regclass, 'mise_actions_expected_impact_bound_check'),
        ('public.mise_actions'::regclass, 'mise_actions_result_bound_check'),
        ('public.action_outcomes'::regclass, 'action_outcomes_payload_bound_check'),
        ('public.restaurant_memories'::regclass, 'restaurant_memories_evidence_bound_check'),
        ('public.activity_events'::regclass, 'activity_events_evidence_bound_check'),
        ('public.activity_events'::regclass, 'activity_events_metadata_bound_check'),
        ('public.supplier_order_confirmations'::regclass, 'supplier_order_confirmations_details_bound_check'),
        ('public.restaurant_tasks'::regclass, 'restaurant_tasks_checklist_bound_check'),
        ('public.restaurant_tasks'::regclass, 'restaurant_tasks_evidence_bound_check'),
        ('public.purchase_decision_events'::regclass, 'purchase_decision_events_context_evidence_check')
    ) as targets(rel, name)
    join pg_constraint constraint_row
      on constraint_row.conrelid = targets.rel
     and constraint_row.conname = targets.name
    where pg_get_constraintdef(constraint_row.oid) ~* 'pg_column_size'
       or pg_get_constraintdef(constraint_row.oid) !~* 'octet_length'
  ),
  'every MISE-005E jsonb bound uses octet_length and not pg_column_size'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_context_evidence_check'
  ),
  'octet_length\(.*context_evidence::text\) <= 8192',
  'purchase decision context_evidence keeps the 8192 logical-byte ceiling'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_evidence_bound_check'
  ),
  'octet_length\(.*evidence::text\) <= 32768',
  'operational_issues evidence keeps the 32768 logical-byte ceiling'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_evidence_bound_check'
  ),
  'octet_length\(.*evidence::text\) <= 32768',
  'mise_actions evidence keeps the 32768 logical-byte ceiling'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_expected_impact_bound_check'
  ),
  'octet_length\(.*expected_impact::text\) <= 16384',
  'mise_actions expected_impact keeps the 16384 logical-byte ceiling'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_result_bound_check'
  ),
  'octet_length\(.*result::text\) <= 16384',
  'mise_actions result keeps the 16384 logical-byte ceiling'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.action_outcomes'::regclass
      and conname = 'action_outcomes_payload_bound_check'
  ),
  'octet_length\(.*expected_result::text\) <= 16384',
  'action_outcomes expected_result keeps the 16384 logical-byte ceiling'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_evidence_bound_check'
  ),
  'octet_length\(.*evidence::text\) <= 32768',
  'restaurant_memories evidence keeps the 32768 logical-byte ceiling'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_evidence_bound_check'
  ),
  'octet_length\(.*evidence_references::text\) <= 32768',
  'activity_events evidence_references keeps the 32768 logical-byte ceiling'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_metadata_bound_check'
  ),
  'octet_length\(.*metadata::text\) <= 16384',
  'activity_events metadata keeps the 16384 logical-byte ceiling'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_checklist_bound_check'
  ),
  'octet_length\(.*checklist::text\) <= 32768',
  'restaurant_tasks checklist keeps the 32768 logical-byte ceiling'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_evidence_bound_check'
  ),
  'octet_length\(.*completion_evidence::text\) <= 32768',
  'restaurant_tasks completion_evidence keeps the 32768 logical-byte ceiling'
);

select * from finish();
rollback;
