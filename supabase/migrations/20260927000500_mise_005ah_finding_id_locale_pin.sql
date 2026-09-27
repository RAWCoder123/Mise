-- MISE-005AH: pin operational_finding_decisions.finding_id shape to
-- COLLATE "C".
--
-- public.operational_finding_decisions stores finding_id with only a length
-- CHECK today. public.record_operational_finding_decision mirrors the shape
-- with bare:
--   trim(p_finding_id) !~ '^finding:[a-z0-9][a-z0-9:_-]{1,231}$'
-- POSIX [a-z0-9:_-] follows database LC_CTYPE. MISE-005A proved locale drift
-- on this cluster; MISE-005AF (#440) pinned policy_version on the same table
-- and RPC but intentionally deferred finding_id.
--
-- finding_id is restore and feedback-write authority. Accepted values are
-- stored on append-only finding decisions and compared for exact-retry
-- continuity. If LC_CTYPE drifted under a bare class check, the RPC
-- preflight could accept bytes a restore CHECK would refuse (or the reverse),
-- breaking manager feedback replay for the same client_event_id /
-- idempotency_key.
--
-- Scope:
--   - Attach operational_finding_decisions_finding_id_shape_check with
--     COLLATE "C" on the class match (additive; keeps the length CHECK)
--   - Rewrite public.record_operational_finding_decision so the
--     finding_id shape gate uses the same COLLATE "C" contract
--   - Preserve revoke from public/anon + grant EXECUTE to authenticated
-- Does NOT rewrite policy_version (owned by open #440),
-- service_record_mise_action_failure, evidence hardening, or fixed enums.
-- Prefer rebase onto #440 after it lands (shared
-- record_operational_finding_decision). Alone on main is safe because #440
-- left finding_id bare. Timestamp after MISE-005AG (#441).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.operational_finding_decisions'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ~ 'finding_id'
      and pg_get_constraintdef(c.oid) ~ 'finding:'
      and pg_get_constraintdef(c.oid) !~* 'collate "C"'
  loop
    execute format(
      'alter table public.operational_finding_decisions drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.operational_finding_decisions
  drop constraint if exists operational_finding_decisions_finding_id_shape_check;

alter table public.operational_finding_decisions
  add constraint operational_finding_decisions_finding_id_shape_check
    check (
      finding_id collate "C" ~ '^finding:[a-z0-9][a-z0-9:_-]{1,231}$'
    );

comment on constraint operational_finding_decisions_finding_id_shape_check
  on public.operational_finding_decisions is
  'MISE-005AH: finding_id ASCII allowlist under COLLATE "C".';

create or replace function public.record_operational_finding_decision(
  p_restaurant_id uuid,
  p_finding_id text,
  p_policy_version text,
  p_decision_type text,
  p_finding_generated_at timestamptz,
  p_finding_category text,
  p_severity text,
  p_confidence_score numeric,
  p_evidence jsonb,
  p_original_recommended_action text,
  p_edited_recommended_action text,
  p_client_event_id text,
  p_idempotency_key text
)
returns public.operational_finding_decisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_decision public.operational_finding_decisions;
  inserted_decision public.operational_finding_decisions;
  normalized_edited_action text :=
    nullif(trim(p_edited_recommended_action), '');
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Not authenticated.';
  end if;

  if not private.has_restaurant_role(
    p_restaurant_id,
    array['owner', 'admin', 'manager']
  ) then
    raise exception using errcode = '42501', message = 'Manager access required.';
  end if;

  if p_finding_id is null
    or trim(p_finding_id) collate "C" !~ '^finding:[a-z0-9][a-z0-9:_-]{1,231}$'
    or p_policy_version is null
    or trim(p_policy_version) !~ '^[a-z0-9][a-z0-9._-]{2,63}$'
    or p_decision_type not in ('approved', 'edited', 'dismissed')
    or p_finding_generated_at is null
    or p_finding_generated_at > now() + interval '5 minutes'
    or p_finding_generated_at < now() - interval '30 days'
    or p_finding_category not in (
      'inventory', 'ordering', 'sales', 'waste',
      'prep', 'cost', 'data_quality'
    )
    or p_severity not in ('info', 'warning', 'urgent')
    or p_confidence_score is null
    or p_confidence_score < 0
    or p_confidence_score > 1
    or p_evidence is null
    or jsonb_typeof(p_evidence) <> 'array'
    or jsonb_array_length(p_evidence) not between 1 and 5
    or pg_catalog.length(p_evidence::text) > 12000
    or nullif(trim(p_original_recommended_action), '') is null
    or length(trim(p_original_recommended_action)) > 320
    or nullif(trim(p_client_event_id), '') is null
    or length(trim(p_client_event_id)) > 200
    or nullif(trim(p_idempotency_key), '') is null
    or length(trim(p_idempotency_key)) > 240
  then
    raise exception using
      errcode = '22023',
      message = 'Operational finding decision evidence is invalid.';
  end if;

  if p_decision_type = 'edited' then
    if normalized_edited_action is null
      or length(normalized_edited_action) > 320
      or normalized_edited_action = trim(p_original_recommended_action)
    then
      raise exception using
        errcode = '22023',
        message = 'Edited findings require a distinct bounded action.';
    end if;
  elsif normalized_edited_action is not null then
    raise exception using
      errcode = '22023',
      message = 'Only edited findings may include an edited action.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_evidence) evidence_row
    where jsonb_typeof(evidence_row) <> 'object'
      or evidence_row->>'id' is null
      or evidence_row->>'type' is null
      or evidence_row->>'observedAt' is null
      or evidence_row->>'summary' is null
      or length(evidence_row->>'id') > 240
      or length(evidence_row->>'type') > 80
      or length(evidence_row->>'summary') > 240
      or (evidence_row->>'observedAt')::timestamptz > now() + interval '5 minutes'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Operational finding evidence references are invalid.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text || E'\x1f' || trim(p_client_event_id),
      0
    )
  );

  select decision.*
  into existing_decision
  from public.operational_finding_decisions decision
  where decision.restaurant_id = p_restaurant_id
    and (
      decision.client_event_id = trim(p_client_event_id)
      or decision.idempotency_key = trim(p_idempotency_key)
    )
  order by decision.sequence
  limit 1;

  if found then
    if existing_decision.finding_id = trim(p_finding_id)
      and existing_decision.policy_version = trim(p_policy_version)
      and existing_decision.decision_type = p_decision_type
      and existing_decision.finding_generated_at = p_finding_generated_at
      and existing_decision.finding_category = p_finding_category
      and existing_decision.severity = p_severity
      and existing_decision.confidence_score = p_confidence_score
      and existing_decision.evidence = p_evidence
      and existing_decision.original_recommended_action =
        trim(p_original_recommended_action)
      and existing_decision.edited_recommended_action is not distinct from
        normalized_edited_action
      and existing_decision.client_event_id = trim(p_client_event_id)
      and existing_decision.idempotency_key = trim(p_idempotency_key)
    then
      return existing_decision;
    end if;

    raise exception using
      errcode = '23505',
      message = 'Operational finding decision idempotency conflict.';
  end if;

  insert into public.operational_finding_decisions (
    restaurant_id,
    finding_id,
    policy_version,
    decision_type,
    finding_generated_at,
    finding_category,
    severity,
    confidence_score,
    evidence,
    original_recommended_action,
    edited_recommended_action,
    client_event_id,
    idempotency_key,
    actor_user_id
  )
  values (
    p_restaurant_id,
    trim(p_finding_id),
    trim(p_policy_version),
    p_decision_type,
    p_finding_generated_at,
    p_finding_category,
    p_severity,
    p_confidence_score,
    p_evidence,
    trim(p_original_recommended_action),
    normalized_edited_action,
    trim(p_client_event_id),
    trim(p_idempotency_key),
    auth.uid()
  )
  returning * into inserted_decision;

  insert into public.audit_logs (
    restaurant_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  )
  values (
    p_restaurant_id,
    auth.uid(),
    'operational_finding.decision_recorded',
    'operational_finding_decisions',
    inserted_decision.id,
    jsonb_build_object(
      'finding_id', inserted_decision.finding_id,
      'policy_version', inserted_decision.policy_version,
      'decision_type', inserted_decision.decision_type,
      'client_event_id', inserted_decision.client_event_id,
      'sequence', inserted_decision.sequence
    )
  );

  return inserted_decision;
end;
$$;

revoke all on function public.record_operational_finding_decision(
  uuid, text, text, text, timestamptz, text, text, numeric,
  jsonb, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_operational_finding_decision(
  uuid, text, text, text, timestamptz, text, text, numeric,
  jsonb, text, text, text, text
) to authenticated;

comment on function public.record_operational_finding_decision(
  uuid, text, text, text, timestamptz, text, text, numeric,
  jsonb, text, text, text, text
) is
  'MISE-005AH: tenant-scoped finding feedback; finding_id shape under COLLATE "C".';
