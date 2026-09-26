-- MISE-005Y: pin service_apply_pilot_operational_control action/reason
-- lower and reason-code shape to COLLATE "C".
--
-- public.service_apply_pilot_operational_control still folds the service-supplied
-- pilot control action and reason_code with bare:
--   lower(btrim(coalesce(p_action, '')))
--   lower(btrim(coalesce(p_reason_code, '')))
-- and then gates the reason with bare:
--   normalized_reason !~ '^[a-z0-9_]{3,64}$'
-- lower() and POSIX [a-z] follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; later MISE-005
-- tips pinned supplier-send / POS / purchase / outreach identity paths, but
-- left the service-only pilot kill-switch mutator on bare lower/btrim and an
-- unpinned reason-code class check.
--
-- The normalized action is allowlisted, compared for immutable request replay,
-- and stored as durable evidence. The normalized reason is shape-checked,
-- compared for replay conflicts, and stored. If LC_CTYPE drifted under bare
-- lower, the same service bytes could fail the ASCII allowlist/shape gate (or
-- accept bytes a restored C-locale gate would refuse) and break exact-retry
-- continuity against prior immutable evidence for the same request_id.
--
-- Scope:
--   - Rewrite public.service_apply_pilot_operational_control so action/reason
--     use: lower(btrim(...) collate "C") collate "C"
--   - Pin reason shape check: (normalized_reason collate "C") !~ '^[a-z0-9_]{3,64}$'
--   - Preserve revoke from public/anon/authenticated + grant EXECUTE to
--     service_role only
-- Does NOT rewrite service_set_system_operational_mode, build_pilot_operational_control_state,
-- or restaurant/system control tables. Must apply after MISE-PILOT-001 atomic
-- controls. Compose-safe alone on main (mutator unreplaced since pilot-001).
-- Timestamp after MISE-005X.

create or replace function public.service_apply_pilot_operational_control(
  p_request_id uuid,
  p_restaurant_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_reason_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_action text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_action, '')) collate "C"
  ) collate "C";
  normalized_reason text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_reason_code, '')) collate "C"
  ) collate "C";
  control_domain text;
  system_controls public.system_operational_controls%rowtype;
  restaurant_controls public.restaurant_operational_controls%rowtype;
  existing_change private.pilot_operational_control_changes%rowtype;
  inserted_change private.pilot_operational_control_changes%rowtype;
  before_state jsonb;
  after_state jsonb;
begin
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'request_id is required.';
  end if;
  if p_restaurant_id is null then
    raise exception using errcode = '22023', message = 'restaurant_id is required.';
  end if;
  if p_actor_user_id is null then
    raise exception using errcode = '22023', message = 'actor_user_id is required.';
  end if;
  if normalized_action not in (
    'enable-square-sync',
    'enable-square-webhooks',
    'enable-order-drafting',
    'enable-gmail-delivery',
    'disable-square',
    'disable-order-drafting',
    'disable-gmail-delivery',
    'disable-external',
    'pause-integrations',
    'resume-normal'
  ) then
    raise exception using errcode = '22023', message = 'Pilot control action is not supported.';
  end if;
  if normalized_reason collate "C" !~ '^[a-z0-9_]{3,64}$' then
    raise exception using errcode = '22023', message = 'Pilot control reason code is not supported.';
  end if;

  control_domain := case
    when normalized_action in ('enable-square-sync', 'enable-square-webhooks', 'disable-square') then 'square'
    when normalized_action in ('enable-order-drafting', 'disable-order-drafting') then 'drafting'
    when normalized_action in ('enable-gmail-delivery', 'disable-gmail-delivery') then 'gmail'
    when normalized_action = 'disable-external' then 'external'
    else 'system_mode'
  end;

  -- Serialize exact retries before checking immutable request evidence.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('mise:pilot-control-request:' || p_request_id::text, 0)
  );

  select changes.*
  into existing_change
  from private.pilot_operational_control_changes changes
  where changes.request_id = p_request_id;

  if found then
    if existing_change.restaurant_id <> p_restaurant_id
      or existing_change.actor_user_id <> p_actor_user_id
      or existing_change.requested_action <> normalized_action
      or existing_change.reason_code <> normalized_reason
    then
      raise exception using
        errcode = '23505',
        message = 'Pilot control request conflicts with existing immutable evidence.';
    end if;
  end if;

  -- All widening commands take the shared row first, then the target row.
  select controls.*
  into system_controls
  from public.system_operational_controls controls
  where controls.singleton
  for update;

  if not found then
    raise exception using errcode = '55000', message = 'System operational controls are unavailable.';
  end if;

  select controls.*
  into restaurant_controls
  from public.restaurant_operational_controls controls
  where controls.restaurant_id = p_restaurant_id
  for update;

  if not found then
    raise exception using errcode = '55000', message = 'Restaurant operational controls are unavailable.';
  end if;

  if existing_change.id is not null then
    -- The immutable applied state proves what the original request committed,
    -- while state is rebuilt under the same live control locks used by a new
    -- mutation. A replay must never present old evidence as current state.
    after_state := private.build_pilot_operational_control_state(p_restaurant_id);
    return jsonb_build_object(
      'outcome', 'already_applied',
      'auditId', existing_change.id,
      'requestId', existing_change.request_id,
      'restaurantId', existing_change.restaurant_id,
      'actorUserId', existing_change.actor_user_id,
      'action', existing_change.requested_action,
      'reasonCode', existing_change.reason_code,
      'changed', false,
      'appliedChanged', existing_change.changed,
      'state', after_state,
      'appliedState', existing_change.after_state,
      'stateMatchesApplied', after_state = existing_change.after_state
    );
  end if;

  -- The requested human actor must be a current configuration authority for
  -- this exact tenant. The backend service role remains the execution identity.
  perform 1
  from public.restaurant_memberships membership
  join auth.users actor on actor.id = membership.user_id
  where membership.restaurant_id = p_restaurant_id
    and membership.user_id = p_actor_user_id
    and membership.status = 'active'
    and membership.role in ('owner', 'admin')
  for key share of membership, actor;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Pilot control actor must be an active owner or admin of the target restaurant.';
  end if;

  if normalized_action like 'enable-%' then
    if system_controls.operational_mode <> 'normal' then
      raise exception using
        errcode = '55000',
        message = 'System operational mode must be normal before enabling a pilot control.';
    end if;

    -- The singleton row serializes shared gate widening. Lock every other
    -- restaurant deterministically before proving single-pilot exclusivity.
    perform controls.restaurant_id
    from public.restaurant_operational_controls controls
    where controls.restaurant_id <> p_restaurant_id
    order by controls.restaurant_id
    for update;
  end if;

  if normalized_action in ('enable-square-sync', 'enable-square-webhooks') then
    if not exists (
      select 1
      from public.pos_integrations integration
      join public.pos_locations location
        on location.restaurant_id = integration.restaurant_id
       and location.pos_integration_id = integration.id
       and location.status = 'active'
      where integration.restaurant_id = p_restaurant_id
        and integration.provider = 'square'
        and integration.status = 'connected'
    ) then
      raise exception using
        errcode = '55000',
        message = 'Square must be connected with at least one active location.';
    end if;

    if exists (
      select 1
      from public.restaurant_operational_controls controls
      where controls.restaurant_id <> p_restaurant_id
        and (controls.square_sync_enabled or controls.square_webhooks_enabled)
    ) then
      raise exception using
        errcode = '55000',
        message = 'Another restaurant already owns the pilot Square control domain.';
    end if;
  end if;

  if normalized_action = 'enable-order-drafting' and exists (
    select 1
    from public.restaurant_operational_controls controls
    where controls.restaurant_id <> p_restaurant_id
      and controls.order_drafting_enabled
  ) then
    raise exception using
      errcode = '55000',
      message = 'Another restaurant already owns the pilot drafting control domain.';
  end if;

  if normalized_action = 'enable-gmail-delivery' then
    if not exists (
      select 1
      from public.restaurant_email_connections connection
      where connection.restaurant_id = p_restaurant_id
        and connection.provider = 'gmail'
        and connection.status = 'connected'
        and nullif(btrim(connection.sender_email), '') is not null
    ) then
      raise exception using
        errcode = '55000',
        message = 'Gmail must be connected with a verified sender.';
    end if;
    if not exists (
      select 1
      from public.supplier_recipients recipient
      where recipient.restaurant_id = p_restaurant_id
        and nullif(btrim(recipient.email), '') is not null
    ) then
      raise exception using
        errcode = '55000',
        message = 'At least one supplier recipient must be configured.';
    end if;
    if exists (
      select 1
      from public.restaurant_operational_controls controls
      where controls.restaurant_id <> p_restaurant_id
        and controls.gmail_delivery_enabled
    ) then
      raise exception using
        errcode = '55000',
        message = 'Another restaurant already owns the pilot Gmail control domain.';
    end if;
  end if;

  before_state := private.build_pilot_operational_control_state(p_restaurant_id);

  case normalized_action
    when 'enable-square-sync' then
      update public.system_operational_controls
      set square_sync_enabled = true, updated_at = now(), updated_by = p_actor_user_id
      where singleton;
      update public.restaurant_operational_controls
      set square_sync_enabled = true, updated_at = now(), updated_by = p_actor_user_id
      where restaurant_id = p_restaurant_id;
    when 'enable-square-webhooks' then
      update public.system_operational_controls
      set square_sync_enabled = true,
          square_webhooks_enabled = true,
          updated_at = now(),
          updated_by = p_actor_user_id
      where singleton;
      update public.restaurant_operational_controls
      set square_sync_enabled = true,
          square_webhooks_enabled = true,
          updated_at = now(),
          updated_by = p_actor_user_id
      where restaurant_id = p_restaurant_id;
    when 'enable-order-drafting' then
      update public.system_operational_controls
      set ordering_policy = 'draft_only',
          order_drafting_enabled = true,
          updated_at = now(),
          updated_by = p_actor_user_id
      where singleton;
      update public.restaurant_operational_controls
      set ordering_policy = 'draft_only',
          order_drafting_enabled = true,
          updated_at = now(),
          updated_by = p_actor_user_id
      where restaurant_id = p_restaurant_id;
    when 'enable-gmail-delivery' then
      update public.system_operational_controls
      set gmail_delivery_enabled = true, updated_at = now(), updated_by = p_actor_user_id
      where singleton;
      update public.restaurant_operational_controls
      set gmail_delivery_enabled = true, updated_at = now(), updated_by = p_actor_user_id
      where restaurant_id = p_restaurant_id;
    when 'disable-square' then
      update public.restaurant_operational_controls
      set square_sync_enabled = false,
          square_webhooks_enabled = false,
          updated_at = now(),
          updated_by = p_actor_user_id
      where restaurant_id = p_restaurant_id;
    when 'disable-order-drafting' then
      update public.restaurant_operational_controls
      set ordering_policy = 'off',
          order_drafting_enabled = false,
          updated_at = now(),
          updated_by = p_actor_user_id
      where restaurant_id = p_restaurant_id;
    when 'disable-gmail-delivery' then
      update public.restaurant_operational_controls
      set gmail_delivery_enabled = false, updated_at = now(), updated_by = p_actor_user_id
      where restaurant_id = p_restaurant_id;
    when 'disable-external' then
      update public.restaurant_operational_controls
      set square_sync_enabled = false,
          square_webhooks_enabled = false,
          ordering_policy = 'off',
          order_drafting_enabled = false,
          gmail_delivery_enabled = false,
          updated_at = now(),
          updated_by = p_actor_user_id
      where restaurant_id = p_restaurant_id;
    when 'pause-integrations' then
      perform 1
      from public.service_set_system_operational_mode(
        p_request_id,
        'integrations_paused',
        normalized_reason,
        p_actor_user_id
      );
    when 'resume-normal' then
      perform 1
      from public.service_set_system_operational_mode(
        p_request_id,
        'normal',
        normalized_reason,
        p_actor_user_id
      );
  end case;

  after_state := private.build_pilot_operational_control_state(p_restaurant_id);

  insert into private.pilot_operational_control_changes (
    request_id,
    restaurant_id,
    actor_user_id,
    requested_action,
    control_domain,
    reason_code,
    before_state,
    after_state,
    changed
  ) values (
    p_request_id,
    p_restaurant_id,
    p_actor_user_id,
    normalized_action,
    control_domain,
    normalized_reason,
    before_state,
    after_state,
    before_state is distinct from after_state
  )
  returning * into inserted_change;

  return jsonb_build_object(
    'outcome', 'applied',
    'auditId', inserted_change.id,
    'requestId', inserted_change.request_id,
    'restaurantId', inserted_change.restaurant_id,
    'actorUserId', inserted_change.actor_user_id,
    'action', inserted_change.requested_action,
    'reasonCode', inserted_change.reason_code,
    'changed', inserted_change.changed,
    'appliedChanged', inserted_change.changed,
    'state', inserted_change.after_state,
    'appliedState', inserted_change.after_state,
    'stateMatchesApplied', true
  );
end;
$$;

revoke all on function public.service_apply_pilot_operational_control(uuid, uuid, text, uuid, text)
from public, anon, authenticated;
grant execute on function public.service_apply_pilot_operational_control(uuid, uuid, text, uuid, text)
to service_role;

comment on function public.service_apply_pilot_operational_control(uuid, uuid, text, uuid, text)
is 'MISE-005Y: service-only atomic pilot control mutation; action/reason lower/btrim uses C locale.';

