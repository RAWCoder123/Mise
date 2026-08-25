-- MISE-PILOT-001 correction: one service-owned transaction for founder pilot
-- control changes, with durable human attribution and replay-safe evidence.

create table private.pilot_operational_control_changes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  restaurant_id uuid not null,
  actor_user_id uuid not null,
  backend_identity text not null default 'service_role_rpc'
    check (backend_identity = 'service_role_rpc'),
  requested_action text not null check (requested_action in (
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
  )),
  control_domain text not null
    check (control_domain in ('square', 'drafting', 'gmail', 'external', 'system_mode')),
  reason_code text not null check (reason_code ~ '^[a-z0-9_]{3,64}$'),
  before_state jsonb not null check (
    jsonb_typeof(before_state) = 'object'
    and octet_length(before_state::text) <= 4096
  ),
  after_state jsonb not null check (
    jsonb_typeof(after_state) = 'object'
    and octet_length(after_state::text) <= 4096
  ),
  changed boolean not null,
  created_at timestamptz not null default now()
);

comment on table private.pilot_operational_control_changes is
  'Append-only, service-owned evidence for one atomic founder pilot control request. Contains bounded control/provider readiness summaries only; never credentials, provider payloads, or recipient addresses.';

alter table private.pilot_operational_control_changes enable row level security;

revoke all on table private.pilot_operational_control_changes
from public, anon, authenticated, service_role;
grant select on table private.pilot_operational_control_changes to service_role;

create or replace function private.block_pilot_operational_control_change_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Pilot operational control history is append-only.';
end;
$$;

revoke all on function private.block_pilot_operational_control_change_mutation()
from public, anon, authenticated, service_role;

create trigger pilot_operational_control_changes_append_only
before update or delete on private.pilot_operational_control_changes
for each row execute function private.block_pilot_operational_control_change_mutation();

create or replace function private.build_pilot_operational_control_state(
  p_restaurant_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'system', jsonb_build_object(
      'singleton', system_controls.singleton,
      'operational_mode', system_controls.operational_mode,
      'square_sync_enabled', system_controls.square_sync_enabled,
      'square_webhooks_enabled', system_controls.square_webhooks_enabled,
      'gmail_delivery_enabled', system_controls.gmail_delivery_enabled,
      'order_drafting_enabled', system_controls.order_drafting_enabled,
      'ordering_policy', system_controls.ordering_policy
    ),
    'restaurant', jsonb_build_object(
      'restaurant_id', restaurant_controls.restaurant_id,
      'square_sync_enabled', restaurant_controls.square_sync_enabled,
      'square_webhooks_enabled', restaurant_controls.square_webhooks_enabled,
      'gmail_delivery_enabled', restaurant_controls.gmail_delivery_enabled,
      'order_drafting_enabled', restaurant_controls.order_drafting_enabled,
      'ordering_policy', restaurant_controls.ordering_policy
    ),
    'square', jsonb_build_object(
      'connected', exists (
        select 1
        from public.pos_integrations integration
        where integration.restaurant_id = p_restaurant_id
          and integration.provider = 'square'
          and integration.status = 'connected'
      ),
      'activeLocations', (
        select count(*)
        from public.pos_locations location
        join public.pos_integrations integration
          on integration.id = location.pos_integration_id
         and integration.restaurant_id = location.restaurant_id
        where location.restaurant_id = p_restaurant_id
          and location.status = 'active'
          and integration.provider = 'square'
          and integration.status = 'connected'
      )
    ),
    'gmail', jsonb_build_object(
      'connected', exists (
        select 1
        from public.restaurant_email_connections connection
        where connection.restaurant_id = p_restaurant_id
          and connection.provider = 'gmail'
          and connection.status = 'connected'
      ),
      'senderVerified', exists (
        select 1
        from public.restaurant_email_connections connection
        where connection.restaurant_id = p_restaurant_id
          and connection.provider = 'gmail'
          and connection.status = 'connected'
          and nullif(btrim(connection.sender_email), '') is not null
      ),
      'configuredRecipients', (
        select count(*)
        from public.supplier_recipients recipient
        where recipient.restaurant_id = p_restaurant_id
          and nullif(btrim(recipient.email), '') is not null
      )
    ),
    'otherEnabled', jsonb_build_object(
      'squareSync', (
        select count(*) from public.restaurant_operational_controls controls
        where controls.restaurant_id <> p_restaurant_id
          and controls.square_sync_enabled
      ),
      'squareWebhooks', (
        select count(*) from public.restaurant_operational_controls controls
        where controls.restaurant_id <> p_restaurant_id
          and controls.square_webhooks_enabled
      ),
      'gmailDelivery', (
        select count(*) from public.restaurant_operational_controls controls
        where controls.restaurant_id <> p_restaurant_id
          and controls.gmail_delivery_enabled
      ),
      'orderDrafting', (
        select count(*) from public.restaurant_operational_controls controls
        where controls.restaurant_id <> p_restaurant_id
          and controls.order_drafting_enabled
      )
    )
  )
  from public.system_operational_controls system_controls
  join public.restaurant_operational_controls restaurant_controls
    on restaurant_controls.restaurant_id = p_restaurant_id
  where system_controls.singleton;
$$;

revoke all on function private.build_pilot_operational_control_state(uuid)
from public, anon, authenticated, service_role;

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
  normalized_action text := lower(btrim(coalesce(p_action, '')));
  normalized_reason text := lower(btrim(coalesce(p_reason_code, '')));
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
  if normalized_reason !~ '^[a-z0-9_]{3,64}$' then
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

    return jsonb_build_object(
      'outcome', 'already_applied',
      'auditId', existing_change.id,
      'requestId', existing_change.request_id,
      'restaurantId', existing_change.restaurant_id,
      'actorUserId', existing_change.actor_user_id,
      'action', existing_change.requested_action,
      'reasonCode', existing_change.reason_code,
      'changed', existing_change.changed,
      'state', existing_change.after_state
    );
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
    'state', inserted_change.after_state
  );
end;
$$;

revoke all on function public.service_apply_pilot_operational_control(uuid, uuid, text, uuid, text)
from public, anon, authenticated;
grant execute on function public.service_apply_pilot_operational_control(uuid, uuid, text, uuid, text)
to service_role;

comment on function public.service_apply_pilot_operational_control(uuid, uuid, text, uuid, text)
is 'Service-only, replay-safe, actor-attributed atomic pilot control mutation and immutable evidence boundary.';
