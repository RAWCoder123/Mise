-- MISE-005Z: pin service_set_system_operational_mode reason_code shape
-- check to COLLATE "C".
--
-- public.service_set_system_operational_mode still gates the service-supplied
-- reason_code with bare:
--   p_reason_code !~ '^[a-z0-9_]{3,64}$'
-- POSIX [a-z] follows database LC_CTYPE. This cluster runs libc en_US.UTF-8.
-- MISE-005A proved locale drift on this cluster; MISE-005Y pinned the sibling
-- pilot kill-switch mutator action/reason lower and reason shape, but left
-- the system operational-mode mutator on an unpinned reason-code class check.
--
-- The reason_code is shape-checked, compared for exact-retry conflicts against
-- immutable request evidence, and stored. If LC_CTYPE drifted under a bare
-- class check, the same service bytes could fail the ASCII allowlist (or
-- accept bytes a restored C-locale gate would refuse) and break exact-retry
-- continuity for the same request_id.
--
-- Scope:
--   - Rewrite public.service_set_system_operational_mode so reason shape uses:
--       (p_reason_code collate "C") !~ '^[a-z0-9_]{3,64}$'
--   - Preserve revoke from public/anon/authenticated + grant EXECUTE to
--     service_role only
-- Does NOT rewrite service_apply_pilot_operational_control, mode history
-- tables, or authenticated mutation blockers. Must apply after
-- enforce_emergency_operational_mode. Compose-safe alone on main (mutator
-- unreplaced since 20260727223000). Timestamp after MISE-005Y.

create or replace function public.service_set_system_operational_mode(
  p_request_id uuid,
  p_next_mode text,
  p_reason_code text,
  p_actor_user_id uuid default null
)
returns table (
  request_id uuid,
  prior_mode text,
  next_mode text,
  recorded_at timestamptz,
  duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_mode text;
  existing_change private.operational_mode_changes%rowtype;
  inserted_change private.operational_mode_changes%rowtype;
begin
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'request_id is required.';
  end if;
  if p_next_mode not in ('normal', 'read_only', 'integrations_paused', 'emergency') then
    raise exception using errcode = '22023', message = 'Operational mode is not supported.';
  end if;
  if p_reason_code is null or p_reason_code collate "C" !~ '^[a-z0-9_]{3,64}$' then
    raise exception using errcode = '22023', message = 'Reason code is not supported.';
  end if;

  select changes.*
  into existing_change
  from private.operational_mode_changes changes
  where changes.request_id = p_request_id;

  if found then
    if existing_change.next_mode <> p_next_mode
      or existing_change.reason_code <> p_reason_code
      or existing_change.actor_user_id is distinct from p_actor_user_id
    then
      raise exception using
        errcode = '23505',
        message = 'Operational mode request conflicts with an existing request.';
    end if;
    return query select
      existing_change.request_id,
      existing_change.prior_mode,
      existing_change.next_mode,
      existing_change.recorded_at,
      true;
    return;
  end if;

  select controls.operational_mode
  into current_mode
  from public.system_operational_controls controls
  where controls.singleton
  for update;

  if current_mode is null then
    raise exception using errcode = '55000', message = 'Operational controls are unavailable.';
  end if;

  insert into private.operational_mode_changes (
    request_id,
    prior_mode,
    next_mode,
    reason_code,
    actor_user_id
  )
  values (
    p_request_id,
    current_mode,
    p_next_mode,
    p_reason_code,
    p_actor_user_id
  )
  returning * into inserted_change;

  update public.system_operational_controls
  set operational_mode = p_next_mode,
      updated_at = now(),
      updated_by = p_actor_user_id
  where singleton;

  return query select
    inserted_change.request_id,
    inserted_change.prior_mode,
    inserted_change.next_mode,
    inserted_change.recorded_at,
    false;
end;
$$;

revoke all on function public.service_set_system_operational_mode(uuid, text, text, uuid)
from public, anon, authenticated;
grant execute on function public.service_set_system_operational_mode(uuid, text, text, uuid)
to service_role;

comment on function public.service_set_system_operational_mode(uuid, text, text, uuid)
is 'Service-only, replay-safe operational mode transition with append-only evidence.';
