-- MISE-005AG: pin private.service_record_mise_action_failure error_code to COLLATE "C".
--
-- private.service_record_mise_action_failure still gates mise_actions failure codes
-- with bare:
--   p_error_code !~ '^[a-z0-9_]{1,80}$'
-- POSIX [a-z0-9_] follows database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; MISE-005AE pinned
-- the shared Gmail/Square helper private.gmail_safe_error_code, but left this
-- separate mise_actions failure path on a bare class check.
--
-- Edge send-supplier-email records bounded failure/unverified outcomes through
-- public.service_record_mise_action_failure → private.service_record_mise_action_failure.
-- Accepted codes are stored on mise_actions.error_code and emitted into
-- activity_events. If LC_CTYPE drifted under a bare class check, dump/restore
-- and Edge→RPC failure recording could disagree on the same provider bytes —
-- accepting a code the restored C-locale gate would refuse (or the reverse)
-- and breaking owner-visible automation-failure continuity for supplier send.
--
-- Scope:
--   - Rewrite private.service_record_mise_action_failure so the error_code
--     shape gate uses COLLATE "C"
--   - Preserve revoke-all + service_role EXECUTE on private and public wrappers
-- Does NOT rewrite public.service_record_mise_action_failure (thin SQL wrapper),
-- private.gmail_safe_error_code (already 005AE), finding_id shape, or Edge
-- Function bodies (already emit lowercase snake_case codes). Compose-safe
-- alone on main (private function unreplaced since operational_backend_foundation).
-- Timestamp after MISE-005AF.

create or replace function private.service_record_mise_action_failure(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_supplier_order_id uuid,
  p_failure_status text,
  p_error_code text,
  p_error_message text
)
returns public.mise_actions
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_row public.mise_actions;
  public_status text;
begin
  if p_failure_status not in ('failed', 'unverified')
    or p_error_code is null
    or p_error_code collate "C" !~ '^[a-z0-9_]{1,80}$'
    or nullif(trim(p_error_message), '') is null
  then
    raise exception 'Action failure evidence is invalid' using errcode = '22023';
  end if;
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.system_operational_controls controls
    where controls.singleton
      and controls.operational_mode <> 'normal'
  ) then
    raise exception 'Action failure recording is paused' using errcode = '55000';
  end if;

  select * into action_row
  from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.action_type = 'send_supplier_order'
    and action.idempotency_key = format('send_supplier_order:%s', p_supplier_order_id)
  for update;
  if not found then
    raise exception 'Supplier send action not found' using errcode = 'P0002';
  end if;
  if action_row.status = 'executed' then return action_row; end if;
  if action_row.status in ('failed', 'unverified') then return action_row; end if;
  if action_row.status in ('rejected', 'cancelled', 'reversed') then
    raise exception 'Supplier send action is not executable' using errcode = '22023';
  end if;

  update public.mise_actions
  set status = p_failure_status,
    error_code = p_error_code,
    error_message = left(trim(p_error_message), 1000),
    updated_at = now()
  where restaurant_id = p_restaurant_id and id = action_row.id
  returning * into action_row;

  public_status := case when p_failure_status = 'unverified'
    then 'could_not_verify' else 'failed' end;
  perform private.append_activity_event(
    p_restaurant_id, 'automation_failed', 'orders',
    case when p_failure_status = 'unverified'
      then 'Supplier order send could not be verified'
      else 'Supplier order send failed'
    end,
    left(trim(p_error_message), 1000),
    now(), 'mise', 'integration', p_actor_user_id,
    'supplier_email_delivery', p_supplier_order_id::text,
    jsonb_build_array(
      jsonb_build_object('type', 'supplier_order', 'id', p_supplier_order_id),
      jsonb_build_object('type', 'mise_action', 'id', action_row.id)
    ),
    array['mise', 'orders', 'gmail']::text[], action_row.id,
    action_row.recommendation_id, action_row.autonomy_level,
    action_row.confidence, public_status, true, null,
    'supplier_order', p_supplier_order_id::text,
    format('supplier-order:%s', p_supplier_order_id),
    action_row.correlation_id, null,
    format('supplier_order:%s:%s:%s', p_supplier_order_id, p_failure_status, p_error_code),
    jsonb_build_object(
      'supplierOrderId', p_supplier_order_id,
      'actionType', action_row.action_type,
      'failureStatus', p_failure_status
    ),
    p_error_code, left(trim(p_error_message), 1000), action_row.location_id
  );
  return action_row;
end;
$$;

revoke all on function private.service_record_mise_action_failure(
  uuid, uuid, uuid, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.service_record_mise_action_failure(
  uuid, uuid, uuid, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function private.service_record_mise_action_failure(
  uuid, uuid, uuid, text, text, text
) to service_role;
grant execute on function public.service_record_mise_action_failure(
  uuid, uuid, uuid, text, text, text
) to service_role;

comment on function private.service_record_mise_action_failure(
  uuid, uuid, uuid, text, text, text
) is
  'MISE-005AG: ASCII mise_actions failure-code allowlist under COLLATE "C".';
