-- Multi-item inventory count sessions with draft progress, submit, and
-- manager approval that applies ledgered quantity adjustments atomically.

create table if not exists public.inventory_count_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  status text not null check (status in ('in_progress', 'submitted', 'approved', 'cancelled')),
  started_by uuid references auth.users(id) on delete set null,
  submitted_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  cancelled_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  cancelled_at timestamptz,
  note text check (note is null or char_length(note) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_count_sessions_submitted_consistency check (
    (status = 'submitted' and submitted_at is not null)
    or (status <> 'submitted')
  ),
  constraint inventory_count_sessions_approved_consistency check (
    (status = 'approved' and approved_at is not null)
    or (status <> 'approved')
  ),
  constraint inventory_count_sessions_cancelled_consistency check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status <> 'cancelled')
  )
);

create unique index if not exists inventory_count_sessions_one_open_per_restaurant_idx
  on public.inventory_count_sessions (restaurant_id)
  where status in ('in_progress', 'submitted');

create index if not exists inventory_count_sessions_restaurant_updated_idx
  on public.inventory_count_sessions (restaurant_id, updated_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_count_sessions_restaurant_id_id_key'
  ) then
    alter table public.inventory_count_sessions
      add constraint inventory_count_sessions_restaurant_id_id_key unique (restaurant_id, id);
  end if;
end $$;

create table if not exists public.inventory_count_lines (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  session_id uuid not null,
  inventory_item_id uuid not null,
  item_name text not null check (char_length(btrim(item_name)) between 1 and 160),
  unit text not null check (char_length(btrim(unit)) between 1 and 40),
  system_quantity_at_start numeric not null check (
    system_quantity_at_start >= 0 and system_quantity_at_start <= 1000000
  ),
  counted_quantity numeric check (
    counted_quantity is null
    or (counted_quantity >= 0 and counted_quantity <= 1000000)
  ),
  note text check (note is null or char_length(note) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_count_lines_session_tenant_fkey
    foreign key (restaurant_id, session_id)
    references public.inventory_count_sessions (restaurant_id, id)
    on delete cascade,
  constraint inventory_count_lines_item_tenant_fkey
    foreign key (restaurant_id, inventory_item_id)
    references public.inventory_items (restaurant_id, id)
    on delete restrict,
  constraint inventory_count_lines_session_item_unique
    unique (session_id, inventory_item_id)
);

create index if not exists inventory_count_lines_session_idx
  on public.inventory_count_lines (session_id, inventory_item_id);

alter table public.inventory_count_sessions enable row level security;
alter table public.inventory_count_lines enable row level security;

drop policy if exists "Members can read inventory count sessions" on public.inventory_count_sessions;
create policy "Members can read inventory count sessions"
on public.inventory_count_sessions for select to authenticated
using (private.is_restaurant_member(restaurant_id));

drop policy if exists "Members can read inventory count lines" on public.inventory_count_lines;
create policy "Members can read inventory count lines"
on public.inventory_count_lines for select to authenticated
using (private.is_restaurant_member(restaurant_id));

revoke all on public.inventory_count_sessions from public, anon, authenticated;
revoke all on public.inventory_count_lines from public, anon, authenticated;
grant select on public.inventory_count_sessions to authenticated;
grant select on public.inventory_count_lines to authenticated;
grant select, insert, update, delete on public.inventory_count_sessions to service_role;
grant select, insert, update, delete on public.inventory_count_lines to service_role;

comment on table public.inventory_count_sessions is
  'Multi-item inventory count workflow. Clients may read; writes go through service-owned RPCs.';
comment on table public.inventory_count_lines is
  'Draft counted quantities for a count session. Applied to inventory_items only on approval.';

create or replace function private.inventory_count_session_detail(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  session_row public.inventory_count_sessions%rowtype;
  lines_json jsonb;
begin
  select * into session_row from public.inventory_count_sessions where id = p_session_id;
  if not found then
    raise exception 'Count session not found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(to_jsonb(line_row) order by line_row.item_name, line_row.id), '[]'::jsonb)
  into lines_json
  from public.inventory_count_lines as line_row
  where line_row.session_id = p_session_id;

  return jsonb_build_object('session', to_jsonb(session_row), 'lines', lines_json);
end;
$$;

revoke all on function private.inventory_count_session_detail(uuid) from public, anon, authenticated;
grant execute on function private.inventory_count_session_detail(uuid) to service_role;

create or replace function private.service_begin_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_note text := nullif(btrim(coalesce(p_note, '')), '');
  open_session_id uuid;
  session_id uuid;
  item_count integer;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  if safe_note is not null and char_length(safe_note) > 240 then
    raise exception 'Count session note is outside supported limits' using errcode = '22023';
  end if;

  select id into open_session_id
  from public.inventory_count_sessions
  where restaurant_id = p_restaurant_id
    and status in ('in_progress', 'submitted')
  limit 1;
  if open_session_id is not null then
    raise exception 'A count session is already open for this restaurant' using errcode = '23505';
  end if;

  select count(*)::integer into item_count
  from public.inventory_items
  where restaurant_id = p_restaurant_id;
  if item_count < 1 then
    raise exception 'Add inventory items before starting a count session' using errcode = '22023';
  end if;
  if item_count > 250 then
    raise exception 'Count sessions support at most 250 items' using errcode = '22023';
  end if;

  insert into public.inventory_count_sessions (
    restaurant_id, status, started_by, started_at, note
  ) values (
    p_restaurant_id, 'in_progress', p_actor_user_id, clock_timestamp(), safe_note
  )
  returning id into session_id;

  insert into public.inventory_count_lines (
    restaurant_id,
    session_id,
    inventory_item_id,
    item_name,
    unit,
    system_quantity_at_start
  )
  select
    p_restaurant_id,
    session_id,
    item.id,
    item.item_name,
    item.unit,
    item.current_quantity
  from public.inventory_items as item
  where item.restaurant_id = p_restaurant_id
  order by item.item_name, item.id;

  return private.inventory_count_session_detail(session_id);
end;
$$;

create or replace function private.service_save_inventory_count_lines(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_session_id uuid,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.inventory_count_sessions%rowtype;
  line_count integer;
  updated_count integer := 0;
  entry jsonb;
  item_id uuid;
  counted numeric;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Count lines payload must be an array' using errcode = '22023';
  end if;
  line_count := jsonb_array_length(p_lines);
  if line_count < 1 or line_count > 250 then
    raise exception 'Count lines payload size is outside supported limits' using errcode = '22023';
  end if;

  select * into session_row
  from public.inventory_count_sessions
  where id = p_session_id and restaurant_id = p_restaurant_id
  for update;
  if not found then raise exception 'Count session not found'; end if;
  if session_row.status <> 'in_progress' then
    raise exception 'Only an in-progress count session can be edited' using errcode = '22023';
  end if;

  for entry in select value from jsonb_array_elements(p_lines)
  loop
    begin
      item_id := (entry->>'inventory_item_id')::uuid;
    exception when others then
      raise exception 'Count line inventory_item_id is invalid' using errcode = '22023';
    end;
    begin
      counted := (entry->>'counted_quantity')::numeric;
    exception when others then
      raise exception 'Count line counted_quantity is invalid' using errcode = '22023';
    end;
    if counted is null or counted < 0 or counted > 1000000 then
      raise exception 'Counted quantity is outside supported limits' using errcode = '22023';
    end if;

    update public.inventory_count_lines
    set counted_quantity = counted,
        updated_at = clock_timestamp()
    where restaurant_id = p_restaurant_id
      and session_id = p_session_id
      and inventory_item_id = item_id;
    if found then
      updated_count := updated_count + 1;
    else
      raise exception 'One or more count lines are not part of this session' using errcode = 'P0002';
    end if;
  end loop;

  if updated_count <> line_count then
    raise exception 'One or more count lines are not part of this session' using errcode = 'P0002';
  end if;

  update public.inventory_count_sessions
  set updated_at = clock_timestamp()
  where id = p_session_id;

  return private.inventory_count_session_detail(p_session_id);
end;
$$;

create or replace function private.service_submit_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.inventory_count_sessions%rowtype;
  incomplete_count integer;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  select * into session_row
  from public.inventory_count_sessions
  where id = p_session_id and restaurant_id = p_restaurant_id
  for update;
  if not found then raise exception 'Count session not found'; end if;
  if session_row.status <> 'in_progress' then
    raise exception 'Only an in-progress count session can be submitted' using errcode = '22023';
  end if;

  select count(*)::integer into incomplete_count
  from public.inventory_count_lines
  where session_id = p_session_id and counted_quantity is null;
  if incomplete_count > 0 then
    raise exception 'Count every item before submitting the session' using errcode = '22023';
  end if;

  update public.inventory_count_sessions
  set status = 'submitted',
      submitted_by = p_actor_user_id,
      submitted_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = p_session_id;

  return private.inventory_count_session_detail(p_session_id);
end;
$$;

create or replace function private.service_cancel_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.inventory_count_sessions%rowtype;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  select * into session_row
  from public.inventory_count_sessions
  where id = p_session_id and restaurant_id = p_restaurant_id
  for update;
  if not found then raise exception 'Count session not found'; end if;
  if session_row.status not in ('in_progress', 'submitted') then
    raise exception 'This count session is already closed' using errcode = '22023';
  end if;

  update public.inventory_count_sessions
  set status = 'cancelled',
      cancelled_by = p_actor_user_id,
      cancelled_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = p_session_id;

  return private.inventory_count_session_detail(p_session_id);
end;
$$;

create or replace function private.service_get_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager', 'staff']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  if not exists (
    select 1
    from public.inventory_count_sessions
    where id = p_session_id and restaurant_id = p_restaurant_id
  ) then
    raise exception 'Count session not found' using errcode = 'P0002';
  end if;

  return private.inventory_count_session_detail(p_session_id);
end;
$$;

create or replace function private.service_approve_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_session_id uuid,
  p_expected_revision bigint,
  p_recommendations jsonb,
  p_insights jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  commit_revision bigint;
  session_row public.inventory_count_sessions%rowtype;
  line_row public.inventory_count_lines%rowtype;
  item_row public.inventory_items%rowtype;
  quantity_before numeric;
  quantity_after numeric;
  changed_count integer := 0;
  line_count integer := 0;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  select planning_revision into current_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id for update;
  if current_revision is distinct from p_expected_revision then
    raise exception 'Planning snapshot changed; retry from a fresh snapshot' using errcode = '40001';
  end if;

  select * into session_row
  from public.inventory_count_sessions
  where id = p_session_id and restaurant_id = p_restaurant_id
  for update;
  if not found then raise exception 'Count session not found'; end if;
  if session_row.status <> 'submitted' then
    raise exception 'Submit the count session before approving adjustments' using errcode = '22023';
  end if;

  for line_row in
    select *
    from public.inventory_count_lines
    where session_id = p_session_id
    order by item_name, id
    for update
  loop
    line_count := line_count + 1;
    if line_row.counted_quantity is null then
      raise exception 'Count every item before approving the session' using errcode = '22023';
    end if;

    select * into item_row
    from public.inventory_items
    where restaurant_id = p_restaurant_id and id = line_row.inventory_item_id
    for update;
    if not found then
      raise exception 'Count line references an inventory item that is no longer available';
    end if;

    quantity_before := item_row.current_quantity;
    quantity_after := line_row.counted_quantity;
    if quantity_after is distinct from quantity_before then
      update public.inventory_items
      set current_quantity = quantity_after,
          last_updated = clock_timestamp()
      where restaurant_id = p_restaurant_id and id = line_row.inventory_item_id;

      insert into public.inventory_movements (
        restaurant_id,
        inventory_item_id,
        actor_user_id,
        reason,
        quantity_before,
        quantity_after,
        source_workflow,
        metadata
      ) values (
        p_restaurant_id,
        line_row.inventory_item_id,
        p_actor_user_id,
        'manual_count',
        quantity_before,
        quantity_after,
        'approve_count_session',
        jsonb_build_object(
          'session_id', p_session_id,
          'system_quantity_at_start', line_row.system_quantity_at_start,
          'variance_from_system', quantity_after - line_row.system_quantity_at_start
        )
      );
      changed_count := changed_count + 1;
    end if;
  end loop;

  if line_count < 1 then
    raise exception 'Count session has no lines to approve' using errcode = '22023';
  end if;

  update public.inventory_count_sessions
  set status = 'approved',
      approved_by = p_actor_user_id,
      approved_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = p_session_id;

  select planning_revision into commit_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id;
  perform private.commit_operational_signals(
    p_actor_user_id, p_restaurant_id, commit_revision, p_recommendations, p_insights, false, '{}'::jsonb
  );

  return private.inventory_count_session_detail(p_session_id)
    || jsonb_build_object('lines_changed', changed_count, 'lines_total', line_count);
end;
$$;

-- Public service_role wrappers (Edge-only).
create or replace function public.service_begin_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_note text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_begin_inventory_count_session(p_actor_user_id, p_restaurant_id, p_note);
$$;

create or replace function public.service_save_inventory_count_lines(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_session_id uuid,
  p_lines jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_save_inventory_count_lines(
    p_actor_user_id, p_restaurant_id, p_session_id, p_lines
  );
$$;

create or replace function public.service_submit_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_session_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_submit_inventory_count_session(
    p_actor_user_id, p_restaurant_id, p_session_id
  );
$$;

create or replace function public.service_cancel_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_session_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_cancel_inventory_count_session(
    p_actor_user_id, p_restaurant_id, p_session_id
  );
$$;

create or replace function public.service_get_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_session_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_get_inventory_count_session(
    p_actor_user_id, p_restaurant_id, p_session_id
  );
$$;

create or replace function public.service_approve_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_session_id uuid,
  p_expected_revision bigint,
  p_recommendations jsonb,
  p_insights jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_approve_inventory_count_session(
    p_actor_user_id,
    p_restaurant_id,
    p_session_id,
    p_expected_revision,
    p_recommendations,
    p_insights
  );
$$;

revoke all on function public.service_begin_inventory_count_session(uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.service_save_inventory_count_lines(uuid, uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.service_submit_inventory_count_session(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.service_cancel_inventory_count_session(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.service_get_inventory_count_session(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.service_approve_inventory_count_session(uuid, uuid, uuid, bigint, jsonb, jsonb) from public, anon, authenticated, service_role;

grant execute on function public.service_begin_inventory_count_session(uuid, uuid, text) to service_role;
grant execute on function public.service_save_inventory_count_lines(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.service_submit_inventory_count_session(uuid, uuid, uuid) to service_role;
grant execute on function public.service_cancel_inventory_count_session(uuid, uuid, uuid) to service_role;
grant execute on function public.service_get_inventory_count_session(uuid, uuid, uuid) to service_role;
grant execute on function public.service_approve_inventory_count_session(uuid, uuid, uuid, bigint, jsonb, jsonb) to service_role;

revoke all on function private.service_begin_inventory_count_session(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.service_save_inventory_count_lines(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.service_submit_inventory_count_session(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.service_cancel_inventory_count_session(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.service_get_inventory_count_session(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.service_approve_inventory_count_session(uuid, uuid, uuid, bigint, jsonb, jsonb) from public, anon, authenticated;
grant execute on function private.service_begin_inventory_count_session(uuid, uuid, text) to service_role;
grant execute on function private.service_save_inventory_count_lines(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function private.service_submit_inventory_count_session(uuid, uuid, uuid) to service_role;
grant execute on function private.service_cancel_inventory_count_session(uuid, uuid, uuid) to service_role;
grant execute on function private.service_get_inventory_count_session(uuid, uuid, uuid) to service_role;
grant execute on function private.service_approve_inventory_count_session(uuid, uuid, uuid, bigint, jsonb, jsonb) to service_role;
