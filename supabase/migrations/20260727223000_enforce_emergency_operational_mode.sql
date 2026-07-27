create table if not exists private.operational_mode_changes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  prior_mode text not null
    check (prior_mode in ('normal', 'read_only', 'integrations_paused', 'emergency')),
  next_mode text not null
    check (next_mode in ('normal', 'read_only', 'integrations_paused', 'emergency')),
  reason_code text not null
    check (reason_code ~ '^[a-z0-9_]{3,64}$'),
  actor_user_id uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);

revoke all on table private.operational_mode_changes
from public, anon, authenticated, service_role;
grant select on table private.operational_mode_changes to service_role;

create or replace function private.block_operational_mode_change_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Operational mode history is append-only.';
end;
$$;

revoke all on function private.block_operational_mode_change_mutation()
from public, anon, authenticated, service_role;

drop trigger if exists operational_mode_changes_append_only
on private.operational_mode_changes;
create trigger operational_mode_changes_append_only
before update or delete on private.operational_mode_changes
for each row execute function private.block_operational_mode_change_mutation();

create or replace function private.enforce_authenticated_operational_mode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_mode text;
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select controls.operational_mode
  into current_mode
  from public.system_operational_controls controls
  where controls.singleton;

  if current_mode in ('read_only', 'emergency') then
    raise exception using
      errcode = '55000',
      message = case
        when current_mode = 'emergency'
          then 'Mise is in emergency mode. Tenant changes are paused.'
        else 'Mise is temporarily read-only. Tenant changes are paused.'
      end;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_authenticated_operational_mode()
from public, anon, authenticated, service_role;

do $$
declare
  target record;
begin
  for target in
    select tables.table_name
    from information_schema.tables tables
    where tables.table_schema = 'public'
      and tables.table_type = 'BASE TABLE'
      and tables.table_name <> 'system_operational_controls'
  loop
    execute format(
      'drop trigger if exists enforce_authenticated_operational_mode on public.%I',
      target.table_name
    );
    execute format(
      'create trigger enforce_authenticated_operational_mode
       before insert or update or delete on public.%I
       for each row execute function private.enforce_authenticated_operational_mode()',
      target.table_name
    );
  end loop;
end;
$$;

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
  if p_reason_code is null or p_reason_code !~ '^[a-z0-9_]{3,64}$' then
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
