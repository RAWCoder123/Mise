-- Persist explicit POS planning freshness after sales sync.
-- Sales may commit while signal refresh fails; operators need a durable stale marker.
-- Concurrent syncs bind planning outcomes to the sales authority generation so an
-- older refresh cannot overwrite a newer sync's planning state.

alter table public.pos_integrations
  add column if not exists planning_sync_status text not null default 'unknown',
  add column if not exists planning_synced_at timestamptz,
  add column if not exists planning_sync_error_code text,
  add column if not exists planning_sync_generation uuid;

do $$
begin
  alter table public.pos_integrations
    add constraint pos_integrations_planning_sync_status_check
    check (planning_sync_status in ('fresh', 'stale', 'unknown'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.pos_integrations
    add constraint pos_integrations_planning_sync_error_code_length_check
    check (planning_sync_error_code is null or char_length(planning_sync_error_code) <= 120);
exception
  when duplicate_object then null;
end $$;

comment on column public.pos_integrations.planning_sync_status is
  'fresh when operational signals match the latest sales sync; stale when sales landed without a successful signal refresh; unknown before the first recorded planning outcome.';
comment on column public.pos_integrations.planning_synced_at is
  'Timestamp of the latest successful planning refresh for this POS integration.';
comment on column public.pos_integrations.planning_sync_error_code is
  'Safe error code when planning remains stale after a failed signal refresh.';
comment on column public.pos_integrations.planning_sync_generation is
  'Sales authority sync token that last marked planning dirty; generation-matched writes refuse superseded outcomes.';

drop function if exists public.service_record_pos_planning_sync_state(uuid, uuid, uuid, text, text);
drop function if exists private.service_record_pos_planning_sync_state(uuid, uuid, uuid, text, text);
drop function if exists public.service_record_pos_planning_sync_state(uuid, uuid, uuid, text, text, uuid, boolean);
drop function if exists private.service_record_pos_planning_sync_state(uuid, uuid, uuid, text, text, uuid, boolean);

create or replace function private.service_record_pos_planning_sync_state(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_status text,
  p_error_code text default null,
  p_generation uuid default null,
  p_match_generation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_status text := lower(coalesce(nullif(btrim(p_status), ''), ''));
  safe_code text := null;
  updated_count integer := 0;
  match_generation boolean := coalesce(p_match_generation, false);
begin
  if p_actor_user_id is null or p_restaurant_id is null then
    raise exception 'POS planning sync state requires actor and restaurant' using errcode = '22023';
  end if;

  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'POS planning sync access denied' using errcode = '42501';
  end if;

  if safe_status not in ('fresh', 'stale') then
    raise exception 'POS planning sync status is invalid' using errcode = '22023';
  end if;

  if p_error_code is not null and btrim(p_error_code) <> '' then
    safe_code := left(private.gmail_safe_error_code(p_error_code), 120);
  end if;

  if safe_status = 'fresh' then
    safe_code := null;
  end if;

  if match_generation and p_generation is null then
    raise exception 'POS planning sync generation match requires a generation' using errcode = '22023';
  end if;

  if p_integration_id is null then
    if match_generation then
      update public.pos_integrations
      set planning_sync_status = safe_status,
        planning_synced_at = case when safe_status = 'fresh' then clock_timestamp() else planning_synced_at end,
        planning_sync_error_code = safe_code,
        planning_sync_generation = case when safe_status = 'fresh' then null else planning_sync_generation end,
        updated_at = clock_timestamp()
      where restaurant_id = p_restaurant_id
        and status = 'connected'
        and planning_sync_generation is not distinct from p_generation;
    else
      update public.pos_integrations
      set planning_sync_status = safe_status,
        planning_synced_at = case when safe_status = 'fresh' then clock_timestamp() else planning_synced_at end,
        planning_sync_error_code = safe_code,
        planning_sync_generation = case
          when safe_status = 'fresh' then null
          else coalesce(p_generation, planning_sync_generation)
        end,
        updated_at = clock_timestamp()
      where restaurant_id = p_restaurant_id
        and status = 'connected';
    end if;
    get diagnostics updated_count = row_count;
  else
    if match_generation then
      update public.pos_integrations
      set planning_sync_status = safe_status,
        planning_synced_at = case when safe_status = 'fresh' then clock_timestamp() else planning_synced_at end,
        planning_sync_error_code = safe_code,
        planning_sync_generation = case when safe_status = 'fresh' then null else planning_sync_generation end,
        updated_at = clock_timestamp()
      where id = p_integration_id
        and restaurant_id = p_restaurant_id
        and planning_sync_generation is not distinct from p_generation;
      get diagnostics updated_count = row_count;
    else
      update public.pos_integrations
      set planning_sync_status = safe_status,
        planning_synced_at = case when safe_status = 'fresh' then clock_timestamp() else planning_synced_at end,
        planning_sync_error_code = safe_code,
        planning_sync_generation = case
          when safe_status = 'fresh' then null
          else coalesce(p_generation, planning_sync_generation)
        end,
        updated_at = clock_timestamp()
      where id = p_integration_id
        and restaurant_id = p_restaurant_id;
      get diagnostics updated_count = row_count;
      if updated_count = 0 then
        raise exception 'POS integration was not found for planning sync state' using errcode = 'P0002';
      end if;
    end if;
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    p_actor_user_id,
    case
      when match_generation and updated_count = 0 then 'pos_planning_sync_skipped'
      when safe_status = 'fresh' then 'pos_planning_sync_fresh'
      else 'pos_planning_sync_stale'
    end,
    'pos_integrations',
    p_integration_id,
    jsonb_build_object(
      'status', safe_status,
      'error_code', safe_code,
      'updated_count', updated_count,
      'generation', p_generation,
      'match_generation', match_generation,
      'skipped', match_generation and updated_count = 0
    )
  );

  return jsonb_build_object(
    'status', safe_status,
    'errorCode', safe_code,
    'updatedCount', updated_count,
    'generation', p_generation,
    'skipped', match_generation and updated_count = 0
  );
end;
$$;

create or replace function public.service_record_pos_planning_sync_state(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_status text,
  p_error_code text default null,
  p_generation uuid default null,
  p_match_generation boolean default false
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_record_pos_planning_sync_state(
    p_actor_user_id,
    p_restaurant_id,
    p_integration_id,
    p_status,
    p_error_code,
    p_generation,
    p_match_generation
  );
$$;

revoke all on function private.service_record_pos_planning_sync_state(uuid, uuid, uuid, text, text, uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.service_record_pos_planning_sync_state(uuid, uuid, uuid, text, text, uuid, boolean)
  from public, anon, authenticated, service_role;

grant execute on function private.service_record_pos_planning_sync_state(uuid, uuid, uuid, text, text, uuid, boolean)
  to service_role;
grant execute on function public.service_record_pos_planning_sync_state(uuid, uuid, uuid, text, text, uuid, boolean)
  to service_role;
