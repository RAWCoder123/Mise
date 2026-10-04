-- MISE-005HJ: pin private.structured_ai_insight_output_is_valid text and
-- allowlist gates to COLLATE "C".
--
-- public.ai_insights.output is validated by
-- private.structured_ai_insight_output_is_valid, which currently bounds title,
-- summary, recommended_action, and evidence strings by length only, and compares
-- risk_level / affected_workflow with bare IN allowlists. Bare POSIX
-- [[:cntrl:]] / bare IN follow database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling tips
-- re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'` and allowlists under
-- COLLATE "C".
--
-- ai_insights output fields are durable structured insight tokens (title,
-- summary, recommended_action, evidence lines, risk_level, affected_workflow).
-- They are not operator free-form multiline prose and must not accept
-- LF/TAB/CR/NUL. If LC_CTYPE drifted under length-only gates, dump/restore
-- could accept output bytes a restored C-locale path would refuse — or the
-- reverse — breaking rules-engine insight continuity across restore.
--
-- Scope:
--   - Rewrite private.structured_ai_insight_output_is_valid so string fields
--     reject ASCII controls under COLLATE "C", and risk_level /
--     affected_workflow allowlists compare under COLLATE "C"
--   - Preserve service_role EXECUTE; public/anon/authenticated revoked
-- Does NOT rewrite service_create_rules_engine_ai_insight, schema_version
-- (#479 / MISE-005BS), provenance (#483 / MISE-005BW), or public.insights
-- content bounds (#550 / MISE-005EL). Timestamp after MISE-005HI (#625).

create or replace function private.structured_ai_insight_output_is_valid(p_output jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  evidence_entry jsonb;
  confidence_value numeric;
  title_text text;
  summary_text text;
  action_text text;
  risk_text text;
  workflow_text text;
  evidence_text text;
begin
  if p_output is null
    or pg_catalog.jsonb_typeof(p_output) <> 'object'
    or pg_catalog.octet_length(p_output::text) > 16384
    or not (p_output ?& array[
      'title', 'summary', 'recommended_action', 'risk_level',
      'confidence', 'affected_workflow', 'evidence'
    ])
    or p_output - array[
      'title', 'summary', 'recommended_action', 'risk_level',
      'confidence', 'affected_workflow', 'evidence'
    ] <> '{}'::jsonb
    or pg_catalog.jsonb_typeof(p_output -> 'title') <> 'string'
    or pg_catalog.jsonb_typeof(p_output -> 'summary') <> 'string'
    or pg_catalog.jsonb_typeof(p_output -> 'recommended_action') <> 'string'
    or pg_catalog.jsonb_typeof(p_output -> 'risk_level') <> 'string'
    or pg_catalog.jsonb_typeof(p_output -> 'affected_workflow') <> 'string'
    or pg_catalog.jsonb_typeof(p_output -> 'confidence') <> 'number'
    or pg_catalog.jsonb_typeof(p_output -> 'evidence') <> 'array'
    or pg_catalog.jsonb_array_length(p_output -> 'evidence') > 6
  then
    return false;
  end if;

  title_text := p_output ->> 'title';
  summary_text := p_output ->> 'summary';
  action_text := p_output ->> 'recommended_action';
  risk_text := p_output ->> 'risk_level';
  workflow_text := p_output ->> 'affected_workflow';

  if pg_catalog.length(title_text) not between 1 and 96
    or title_text collate "C" ~ '[[:cntrl:]]'
    or pg_catalog.length(summary_text) not between 1 and 500
    or summary_text collate "C" ~ '[[:cntrl:]]'
    or pg_catalog.length(action_text) not between 1 and 240
    or action_text collate "C" ~ '[[:cntrl:]]'
    or risk_text collate "C" not in ('low', 'medium', 'high')
    or workflow_text collate "C" not in (
      'inventory', 'ordering', 'prep', 'sales', 'waste', 'cost'
    )
  then
    return false;
  end if;

  begin
    confidence_value := (p_output ->> 'confidence')::numeric;
  exception when others then
    return false;
  end;
  if confidence_value < 0 or confidence_value > 1 then return false; end if;

  for evidence_entry in
    select element.value
    from pg_catalog.jsonb_array_elements(p_output -> 'evidence') element(value)
  loop
    evidence_text := evidence_entry #>> '{}';
    if pg_catalog.jsonb_typeof(evidence_entry) <> 'string'
      or pg_catalog.length(evidence_text) not between 1 and 180
      or evidence_text collate "C" ~ '[[:cntrl:]]'
    then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function private.structured_ai_insight_output_is_valid(jsonb)
from public, anon, authenticated, service_role;
grant execute on function private.structured_ai_insight_output_is_valid(jsonb)
to service_role;

comment on function private.structured_ai_insight_output_is_valid(jsonb) is
  'MISE-005HJ: ai_insights structured output validator with length bounds, COLLATE "C" ASCII control rejection on text fields, and COLLATE "C" risk/workflow allowlists.';
