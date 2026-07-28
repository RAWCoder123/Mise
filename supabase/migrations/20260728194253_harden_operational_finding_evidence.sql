create or replace function private.reject_unbounded_operational_finding_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from jsonb_array_elements(new.evidence) evidence_row
    where jsonb_typeof(evidence_row) <> 'object'
      or not evidence_row ?& array['type', 'id', 'observedAt', 'summary']
      or evidence_row - array['type', 'id', 'observedAt', 'summary'] <> '{}'::jsonb
      or evidence_row->>'type' not in (
        'inventory_item', 'purchase_recommendation', 'insight',
        'pos_sale', 'menu_mapping', 'data_gap'
      )
      or length(trim(evidence_row->>'id')) not between 1 and 240
      or length(trim(evidence_row->>'summary')) not between 1 and 240
      or (evidence_row->>'observedAt')::timestamptz > now() + interval '5 minutes'
      or (evidence_row->>'observedAt')::timestamptz < now() - interval '30 days'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Operational finding evidence references are invalid.';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_unbounded_operational_finding_evidence()
from public, anon, authenticated, service_role;

create trigger reject_unbounded_operational_finding_evidence
before insert on public.operational_finding_decisions
for each row execute function private.reject_unbounded_operational_finding_evidence();

comment on function private.reject_unbounded_operational_finding_evidence() is
  'Rejects extra, stale, malformed, or unsupported evidence before append-only finding feedback can persist or enter an export.';
