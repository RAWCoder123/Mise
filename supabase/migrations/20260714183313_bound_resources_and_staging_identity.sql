-- Bound user-controlled resources, make staging identity verifiable before
-- trusted credentials are used, and enforce workspace creation quotas.

update public.restaurants set name = left(trim(name), 120) where length(trim(name)) > 120;
alter table public.restaurants drop constraint if exists restaurants_name_length_check;
alter table public.restaurants
  add constraint restaurants_name_length_check check (length(trim(name)) between 1 and 120);

create or replace function private.create_restaurant_with_owner(
  restaurant_name text,
  restaurant_cuisine_type text default null
)
returns public.restaurants
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_restaurant public.restaurants;
  active_owner_workspace_count integer;
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  restaurant_name := trim(restaurant_name);
  if length(restaurant_name) not between 1 and 120 then
    raise exception 'Restaurant name must be between 1 and 120 characters' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || E'\x1fowner-workspace-quota', 0));
  select count(*)::integer into active_owner_workspace_count
  from public.restaurant_memberships membership
  where membership.user_id = current_user_id
    and membership.role = 'owner'
    and membership.status = 'active';
  if active_owner_workspace_count >= 5 then
    raise exception 'A user may own at most five active restaurant workspaces' using errcode = '54000';
  end if;

  insert into public.restaurants (name, cuisine_type)
  values (restaurant_name, nullif(trim(restaurant_cuisine_type), ''))
  returning * into new_restaurant;
  insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
  values (new_restaurant.id, current_user_id, 'owner', 'active');
  return new_restaurant;
end;
$$;

revoke all on function private.create_restaurant_with_owner(text, text) from public, anon;
grant execute on function private.create_restaurant_with_owner(text, text) to authenticated;

create or replace function private.truncate_utf8(p_value text, p_maximum_bytes integer)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  result text := coalesce(p_value, '');
begin
  if p_maximum_bytes < 1 then return ''; end if;
  while octet_length(result) > p_maximum_bytes loop
    result := left(result, greatest(length(result) - greatest(1, (octet_length(result) - p_maximum_bytes) / 2), 0));
  end loop;
  return result;
end;
$$;

revoke all on function private.truncate_utf8(text, integer) from public, anon, authenticated;

update public.supplier_orders
set operator_note = nullif(left(trim(operator_note), 2000), '')
where operator_note is not null;

create or replace function private.build_supplier_order_message(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_supplier_name text,
  p_operator_note text
)
returns text
language sql
security invoker
set search_path = ''
as $$
  with generated_lines as (
    select string_agg(
      recommendation.item_name || ' - ' || recommendation.recommended_quantity::text || ' ' || recommendation.unit,
      E'\n' order by recommendation.item_name, recommendation.id
    ) as body
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved'
  )
  select private.truncate_utf8(
    'Order draft for ' || p_supplier_name || E'\n\n' || coalesce(generated_lines.body, '') ||
    E'\n\nDelivery requested: Tomorrow morning' ||
    case when nullif(trim(p_operator_note), '') is null then ''
      else E'\n\nNotes:\n' || left(trim(p_operator_note), 2000) end,
    65536
  )
  from generated_lines;
$$;

update public.supplier_orders supplier_order
set order_message = private.build_supplier_order_message(
  supplier_order.restaurant_id,
  supplier_order.id,
  supplier_order.supplier_name,
  supplier_order.operator_note
)
where supplier_order.status = 'draft';
update public.supplier_orders
set order_message = private.truncate_utf8(order_message, 65536)
where octet_length(order_message) > 65536;

alter table public.supplier_orders
  drop constraint if exists supplier_orders_operator_note_length_check;
alter table public.supplier_orders
  add constraint supplier_orders_operator_note_length_check check (
    operator_note is null or length(operator_note) <= 2000
  );
alter table public.supplier_orders
  drop constraint if exists supplier_orders_message_size_check;
alter table public.supplier_orders
  add constraint supplier_orders_message_size_check check (octet_length(order_message) <= 65536);

create table if not exists private.environment_identity (
  singleton boolean primary key default true check (singleton),
  staging_marker text not null check (length(staging_marker) between 16 and 200),
  configured_at timestamptz not null default now()
);
alter table private.environment_identity enable row level security;
revoke all on table private.environment_identity from public, anon, authenticated, service_role;

comment on table private.environment_identity is
  'Empty by default. Configure exactly one non-secret marker only in the disposable staging database.';

create or replace function public.verify_staging_identity(p_expected_marker text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select length(coalesce(p_expected_marker, '')) between 16 and 200
    and exists (
      select 1 from private.environment_identity identity_row
      where identity_row.singleton and identity_row.staging_marker = p_expected_marker
    );
$$;

revoke all on function public.verify_staging_identity(text) from public, anon, authenticated, service_role;
grant execute on function public.verify_staging_identity(text) to anon, authenticated;

create or replace function private.normalize_setup_completion_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.action = 'setup_completed' and not exists (
    select 1 from private.restaurant_signal_state signal_state
    where signal_state.restaurant_id = new.restaurant_id
      and signal_state.status = 'current'
      and signal_state.signals_revision = signal_state.planning_revision
  ) then
    if exists (
      select 1 from public.audit_logs audit
      where audit.restaurant_id = new.restaurant_id
        and audit.action = 'setup_saved'
        and audit.metadata->>'setup_fingerprint' = new.metadata->>'setup_fingerprint'
    ) then
      return null;
    end if;
    new.action := 'setup_saved';
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_setup_completion_audit() from public, anon, authenticated;
drop trigger if exists audit_setup_completion_requires_current_signals on public.audit_logs;
create trigger audit_setup_completion_requires_current_signals
before insert on public.audit_logs
for each row execute function private.normalize_setup_completion_audit();

revoke insert, update, delete on public.pos_sales from authenticated;
