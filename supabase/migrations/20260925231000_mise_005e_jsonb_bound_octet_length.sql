-- MISE-005E: replace pg_column_size jsonb CHECK bounds with octet_length(...::text).
--
-- PostgreSQL assumes CHECK expressions are retrospectively immutable. pg_column_size
-- is not: it reports the on-disk representation, which can change with TOAST
-- compression, storage settings, or server version. A dump/restore can therefore
-- reject rows the source accepted even though the logical jsonb content is
-- unchanged.
--
-- Later Mise migrations (MISE-003A purchase authority, pilot operational controls)
-- already bound jsonb with octet_length(value::text), which depends only on the
-- logical text form. This migration brings the remaining foundation, shared-task,
-- and purchase-decision CHECK constraints into the same contract.
--
-- Scope is CHECK constraints only. Function-body guards such as
-- record_supplier_delivery's p_lines size check are left alone so this change
-- does not rewrite contested receive paths owned by other open stacks.
--
-- Bounds keep their existing byte ceilings. octet_length(...::text) can be larger
-- than a compressed pg_column_size for the same value, so the effective logical
-- ceiling is unchanged or tighter — never looser.

-- operational_issues.evidence
alter table public.operational_issues
  drop constraint if exists operational_issues_evidence_bound_check;
alter table public.operational_issues
  add constraint operational_issues_evidence_bound_check
  check (pg_catalog.octet_length(evidence::text) <= 32768);

-- mise_actions jsonb payloads
alter table public.mise_actions
  drop constraint if exists mise_actions_evidence_bound_check;
alter table public.mise_actions
  add constraint mise_actions_evidence_bound_check
  check (pg_catalog.octet_length(evidence::text) <= 32768);

alter table public.mise_actions
  drop constraint if exists mise_actions_expected_impact_bound_check;
alter table public.mise_actions
  add constraint mise_actions_expected_impact_bound_check
  check (
    expected_impact is null
    or (
      jsonb_typeof(expected_impact) = 'object'
      and pg_catalog.octet_length(expected_impact::text) <= 16384
    )
  );

alter table public.mise_actions
  drop constraint if exists mise_actions_result_bound_check;
alter table public.mise_actions
  add constraint mise_actions_result_bound_check
  check (
    result is null
    or (
      jsonb_typeof(result) = 'object'
      and pg_catalog.octet_length(result::text) <= 16384
    )
  );

-- action_outcomes jsonb payloads
alter table public.action_outcomes
  drop constraint if exists action_outcomes_payload_bound_check;
alter table public.action_outcomes
  add constraint action_outcomes_payload_bound_check
  check (
    pg_catalog.octet_length(expected_result::text) <= 16384
    and pg_catalog.octet_length(actual_result::text) <= 16384
    and pg_catalog.octet_length(variance::text) <= 16384
  );

-- restaurant_memories.evidence
alter table public.restaurant_memories
  drop constraint if exists restaurant_memories_evidence_bound_check;
alter table public.restaurant_memories
  add constraint restaurant_memories_evidence_bound_check
  check (pg_catalog.octet_length(evidence::text) <= 32768);

-- activity_events evidence + metadata
alter table public.activity_events
  drop constraint if exists activity_events_evidence_bound_check;
alter table public.activity_events
  add constraint activity_events_evidence_bound_check
  check (pg_catalog.octet_length(evidence_references::text) <= 32768);

alter table public.activity_events
  drop constraint if exists activity_events_metadata_bound_check;
alter table public.activity_events
  add constraint activity_events_metadata_bound_check
  check (pg_catalog.octet_length(metadata::text) <= 16384);

-- supplier_order_confirmations.normalized_details
alter table public.supplier_order_confirmations
  drop constraint if exists supplier_order_confirmations_details_bound_check;
alter table public.supplier_order_confirmations
  add constraint supplier_order_confirmations_details_bound_check
  check (pg_catalog.octet_length(normalized_details::text) <= 16384);

-- restaurant_tasks checklist + completion evidence
alter table public.restaurant_tasks
  drop constraint if exists restaurant_tasks_checklist_bound_check;
alter table public.restaurant_tasks
  add constraint restaurant_tasks_checklist_bound_check
  check (
    jsonb_array_length(checklist) <= 32
    and pg_catalog.octet_length(checklist::text) <= 32768
  );

alter table public.restaurant_tasks
  drop constraint if exists restaurant_tasks_evidence_bound_check;
alter table public.restaurant_tasks
  add constraint restaurant_tasks_evidence_bound_check
  check (
    jsonb_array_length(completion_evidence) <= 32
    and pg_catalog.octet_length(completion_evidence::text) <= 32768
  );

-- purchase_decision_events.context_evidence (inline column check on 004A)
alter table public.purchase_decision_events
  drop constraint if exists purchase_decision_events_context_evidence_check;
alter table public.purchase_decision_events
  add constraint purchase_decision_events_context_evidence_check
  check (
    jsonb_typeof(context_evidence) = 'object'
    and pg_catalog.octet_length(context_evidence::text) <= 8192
  );

comment on constraint operational_issues_evidence_bound_check on public.operational_issues is
  'MISE-005E: logical jsonb byte bound via octet_length(...::text); not pg_column_size.';
comment on constraint purchase_decision_events_context_evidence_check on public.purchase_decision_events is
  'MISE-005E: logical jsonb byte bound via octet_length(...::text); not pg_column_size.';
