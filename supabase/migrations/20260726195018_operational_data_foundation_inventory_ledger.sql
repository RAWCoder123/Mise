create extension if not exists "btree_gist" with schema extensions;

create table if not exists public.system_operational_controls (
  singleton boolean primary key default true check (singleton),
  operational_mode text not null default 'normal'
    check (operational_mode in ('normal', 'read_only', 'integrations_paused', 'emergency')),
  square_sync_enabled boolean not null default false,
  square_webhooks_enabled boolean not null default false,
  gmail_delivery_enabled boolean not null default false,
  insight_generation_enabled boolean not null default false,
  order_drafting_enabled boolean not null default false,
  stripe_invoicing_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.system_operational_controls (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.restaurant_operational_controls (
  restaurant_id uuid not null primary key references public.restaurants(id) on delete cascade,
  square_sync_enabled boolean not null default false,
  square_webhooks_enabled boolean not null default false,
  gmail_delivery_enabled boolean not null default false,
  insight_generation_enabled boolean not null default false,
  order_drafting_enabled boolean not null default false,
  stripe_invoicing_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.pos_locations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  pos_integration_id uuid not null references public.pos_integrations(id) on delete cascade,
  external_location_id text not null,
  display_name text not null,
  timezone text,
  status text not null default 'active' check (status in ('active', 'paused', 'disconnected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, pos_integration_id, external_location_id)
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  category text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id)
);

create unique index if not exists menu_items_restaurant_normalized_name_key
  on public.menu_items (restaurant_id, lower(trim(name)));

create table if not exists public.pos_catalog_item_mappings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  pos_location_id uuid not null,
  external_catalog_item_id text not null,
  external_variation_id text not null default '',
  external_name text not null,
  menu_item_id uuid not null,
  verification_status text not null default 'draft'
    check (verification_status in ('draft', 'verified', 'rejected', 'expired')),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (
    restaurant_id,
    pos_location_id,
    external_catalog_item_id,
    external_variation_id,
    effective_from
  ),
  constraint pos_catalog_item_mapping_window_check
    check (effective_to is null or effective_to > effective_from),
  constraint pos_catalog_item_mapping_location_fkey
    foreign key (restaurant_id, pos_location_id)
    references public.pos_locations (restaurant_id, id) on delete cascade,
  constraint pos_catalog_item_mapping_menu_item_fkey
    foreign key (restaurant_id, menu_item_id)
    references public.menu_items (restaurant_id, id) on delete cascade
);

create table if not exists public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  menu_item_id uuid not null,
  pos_location_id uuid,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'verified', 'retired')),
  serving_quantity numeric not null default 1 check (serving_quantity > 0),
  prep_yield numeric not null default 1 check (prep_yield > 0 and prep_yield <= 1),
  cooking_yield numeric not null default 1 check (cooking_yield > 0 and cooking_yield <= 1),
  effective_from timestamptz not null,
  effective_to timestamptz,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, menu_item_id, pos_location_id, version_number),
  constraint recipe_version_window_check
    check (effective_to is null or effective_to > effective_from),
  constraint recipe_version_menu_item_fkey
    foreign key (restaurant_id, menu_item_id)
    references public.menu_items (restaurant_id, id) on delete cascade,
  constraint recipe_version_location_fkey
    foreign key (restaurant_id, pos_location_id)
    references public.pos_locations (restaurant_id, id) on delete cascade
);

alter table public.recipe_versions
  drop constraint if exists recipe_versions_no_overlapping_active_windows;

alter table public.recipe_versions
  add constraint recipe_versions_no_overlapping_active_windows
  exclude using gist (
    restaurant_id with =,
    menu_item_id with =,
    (coalesce(pos_location_id, '00000000-0000-0000-0000-000000000000'::uuid)) with =,
    tstzrange(effective_from, coalesce(effective_to, 'infinity'::timestamptz), '[)') with &&
  )
  where (status <> 'retired');

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  recipe_version_id uuid not null,
  inventory_item_id uuid not null,
  quantity numeric not null check (quantity > 0),
  canonical_unit text not null check (canonical_unit in ('g', 'ml', 'each')),
  verification_status text not null default 'draft'
    check (verification_status in ('draft', 'verified', 'rejected', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, recipe_version_id, inventory_item_id),
  constraint recipe_ingredient_version_fkey
    foreign key (restaurant_id, recipe_version_id)
    references public.recipe_versions (restaurant_id, id) on delete cascade,
  constraint recipe_ingredient_inventory_item_fkey
    foreign key (restaurant_id, inventory_item_id)
    references public.inventory_items (restaurant_id, id) on delete restrict
);

create table if not exists public.modifier_recipe_adjustments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  recipe_version_id uuid not null,
  external_modifier_id text not null,
  modifier_name text not null,
  inventory_item_id uuid not null,
  quantity_delta numeric not null check (quantity_delta <> 0),
  canonical_unit text not null check (canonical_unit in ('g', 'ml', 'each')),
  verification_status text not null default 'draft'
    check (verification_status in ('draft', 'verified', 'rejected', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, recipe_version_id, external_modifier_id, inventory_item_id),
  constraint modifier_recipe_version_fkey
    foreign key (restaurant_id, recipe_version_id)
    references public.recipe_versions (restaurant_id, id) on delete cascade,
  constraint modifier_inventory_item_fkey
    foreign key (restaurant_id, inventory_item_id)
    references public.inventory_items (restaurant_id, id) on delete restrict
);

create table if not exists public.ingredient_substitutions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source_inventory_item_id uuid not null,
  substitute_inventory_item_id uuid not null,
  source_quantity numeric not null check (source_quantity > 0),
  substitute_quantity numeric not null check (substitute_quantity > 0),
  canonical_unit text not null check (canonical_unit in ('g', 'ml', 'each')),
  verification_status text not null default 'draft'
    check (verification_status in ('draft', 'verified', 'rejected', 'expired')),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  constraint ingredient_substitution_distinct_items
    check (source_inventory_item_id <> substitute_inventory_item_id),
  constraint ingredient_substitution_window_check
    check (effective_to is null or effective_to > effective_from),
  constraint ingredient_substitution_source_fkey
    foreign key (restaurant_id, source_inventory_item_id)
    references public.inventory_items (restaurant_id, id) on delete cascade,
  constraint ingredient_substitution_target_fkey
    foreign key (restaurant_id, substitute_inventory_item_id)
    references public.inventory_items (restaurant_id, id) on delete cascade
);

alter table public.supplier_items
  add column if not exists inventory_item_id uuid,
  add column if not exists pack_quantity numeric,
  add column if not exists canonical_unit text,
  add column if not exists verification_status text not null default 'draft',
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

do $$
begin
  alter table public.supplier_items
    add constraint supplier_items_pack_quantity_check
    check (pack_quantity is null or pack_quantity > 0);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.supplier_items
    add constraint supplier_items_canonical_unit_check
    check (canonical_unit is null or canonical_unit in ('g', 'ml', 'each'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.supplier_items
    add constraint supplier_items_verification_status_check
    check (verification_status in ('draft', 'verified', 'rejected', 'expired'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.supplier_items
    add constraint supplier_items_inventory_item_fkey
    foreign key (restaurant_id, inventory_item_id)
    references public.inventory_items (restaurant_id, id) on delete set null;
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  sequence bigint generated by default as identity unique,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  inventory_item_id uuid not null,
  event_type text not null
    check (event_type in ('receipt', 'count', 'waste', 'stockout', 'usage', 'adjustment', 'transfer', 'correction')),
  quantity numeric not null,
  canonical_unit text not null check (canonical_unit in ('g', 'ml', 'each')),
  effective_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  source text not null check (length(trim(source)) between 1 and 80),
  source_reference text,
  reason_code text,
  client_event_id text not null check (length(trim(client_event_id)) between 1 and 200),
  idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 240),
  supersedes_event_id uuid references public.inventory_events(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  constraint inventory_event_item_fkey
    foreign key (restaurant_id, inventory_item_id)
    references public.inventory_items (restaurant_id, id) on delete restrict,
  constraint inventory_event_quantity_check check (
    (event_type in ('receipt', 'count', 'waste', 'usage') and quantity >= 0)
    or (event_type = 'stockout' and quantity = 0)
    or event_type in ('adjustment', 'transfer', 'correction')
  ),
  constraint inventory_event_supersedes_check check (
    supersedes_event_id is null or event_type = 'correction'
  ),
  unique (restaurant_id, client_event_id),
  unique (restaurant_id, idempotency_key)
);

create unique index if not exists inventory_events_supersedes_once_key
  on public.inventory_events (restaurant_id, supersedes_event_id)
  where supersedes_event_id is not null;

create index if not exists inventory_events_projection_idx
  on public.inventory_events (restaurant_id, inventory_item_id, sequence);

create or replace function private.reject_inventory_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Inventory events are append-only' using errcode = '55000';
end;
$$;

drop trigger if exists reject_inventory_event_update_delete on public.inventory_events;
create trigger reject_inventory_event_update_delete
before update or delete on public.inventory_events
for each row execute function private.reject_inventory_event_mutation();

create or replace function public.record_inventory_event(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_event_type text,
  p_quantity numeric,
  p_canonical_unit text,
  p_effective_at timestamptz,
  p_source text,
  p_client_event_id text,
  p_idempotency_key text,
  p_source_reference text default null,
  p_reason_code text default null,
  p_supersedes_event_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.inventory_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_event public.inventory_events;
  superseded_event public.inventory_events;
  inserted_event public.inventory_events;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not private.has_restaurant_role(
    p_restaurant_id,
    array['owner', 'admin', 'manager']
  ) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  if p_event_type not in (
    'receipt', 'count', 'waste', 'stockout',
    'usage', 'adjustment', 'transfer', 'correction'
  ) then
    raise exception 'Unsupported inventory event type' using errcode = '22023';
  end if;

  if p_canonical_unit not in ('g', 'ml', 'each') then
    raise exception 'Canonical unit must be g, ml, or each' using errcode = '22023';
  end if;

  if p_quantity is null
    or (p_event_type in ('receipt', 'count', 'waste', 'usage') and p_quantity < 0)
    or (p_event_type = 'stockout' and p_quantity <> 0)
  then
    raise exception 'Invalid quantity for inventory event type' using errcode = '22023';
  end if;

  if p_effective_at is null
    or nullif(trim(p_source), '') is null
    or nullif(trim(p_client_event_id), '') is null
    or nullif(trim(p_idempotency_key), '') is null
    or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object'
  then
    raise exception 'Inventory event evidence is incomplete' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.inventory_items item
    where item.restaurant_id = p_restaurant_id
      and item.id = p_inventory_item_id
  ) then
    raise exception 'Inventory item not found for restaurant' using errcode = '23503';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text || E'\x1f' || trim(p_client_event_id),
      0
    )
  );

  select event.*
  into existing_event
  from public.inventory_events event
  where event.restaurant_id = p_restaurant_id
    and (
      event.client_event_id = trim(p_client_event_id)
      or event.idempotency_key = trim(p_idempotency_key)
    )
  order by event.sequence
  limit 1;

  if found then
    if existing_event.inventory_item_id = p_inventory_item_id
      and existing_event.event_type = p_event_type
      and existing_event.quantity = p_quantity
      and existing_event.canonical_unit = p_canonical_unit
      and existing_event.effective_at = p_effective_at
      and existing_event.source = trim(p_source)
      and existing_event.source_reference is not distinct from nullif(trim(p_source_reference), '')
      and existing_event.reason_code is not distinct from nullif(trim(p_reason_code), '')
      and existing_event.client_event_id = trim(p_client_event_id)
      and existing_event.idempotency_key = trim(p_idempotency_key)
      and existing_event.supersedes_event_id is not distinct from p_supersedes_event_id
      and existing_event.metadata = coalesce(p_metadata, '{}'::jsonb)
    then
      return existing_event;
    end if;

    raise exception 'Inventory event idempotency conflict' using errcode = '23505';
  end if;

  if p_supersedes_event_id is not null then
    if p_event_type <> 'correction' then
      raise exception 'Only correction events can supersede history' using errcode = '22023';
    end if;

    select event.*
    into superseded_event
    from public.inventory_events event
    where event.id = p_supersedes_event_id
      and event.restaurant_id = p_restaurant_id
      and event.inventory_item_id = p_inventory_item_id;

    if not found then
      raise exception 'Superseded event not found for inventory item' using errcode = '23503';
    end if;

    if exists (
      select 1
      from public.inventory_events event
      where event.restaurant_id = p_restaurant_id
        and event.supersedes_event_id = p_supersedes_event_id
    ) then
      raise exception 'Inventory event has already been superseded' using errcode = '23505';
    end if;
  end if;

  insert into public.inventory_events (
    restaurant_id,
    inventory_item_id,
    event_type,
    quantity,
    canonical_unit,
    effective_at,
    actor_user_id,
    source,
    source_reference,
    reason_code,
    client_event_id,
    idempotency_key,
    supersedes_event_id,
    metadata
  )
  values (
    p_restaurant_id,
    p_inventory_item_id,
    p_event_type,
    p_quantity,
    p_canonical_unit,
    p_effective_at,
    auth.uid(),
    trim(p_source),
    nullif(trim(p_source_reference), ''),
    nullif(trim(p_reason_code), ''),
    trim(p_client_event_id),
    trim(p_idempotency_key),
    p_supersedes_event_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into inserted_event;

  insert into public.audit_logs (
    restaurant_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  )
  values (
    p_restaurant_id,
    auth.uid(),
    'inventory_event.recorded',
    'inventory_events',
    inserted_event.id,
    jsonb_build_object(
      'event_type', inserted_event.event_type,
      'client_event_id', inserted_event.client_event_id,
      'sequence', inserted_event.sequence
    )
  );

  return inserted_event;
end;
$$;

alter table public.system_operational_controls enable row level security;
alter table public.restaurant_operational_controls enable row level security;
alter table public.pos_locations enable row level security;
alter table public.menu_items enable row level security;
alter table public.pos_catalog_item_mappings enable row level security;
alter table public.recipe_versions enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.modifier_recipe_adjustments enable row level security;
alter table public.ingredient_substitutions enable row level security;
alter table public.inventory_events enable row level security;

create policy "Authenticated users can read global operational controls"
on public.system_operational_controls for select
to authenticated
using ((select auth.uid()) is not null);

create policy "Members can read restaurant operational controls"
on public.restaurant_operational_controls for select
to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Owners and admins can update restaurant operational controls"
on public.restaurant_operational_controls for update
to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']))
with check (
  private.has_restaurant_role(restaurant_id, array['owner', 'admin'])
  and updated_by = (select auth.uid())
);

create policy "Members can read POS locations"
on public.pos_locations for select
to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Members can read menu items"
on public.menu_items for select
to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Members can read POS catalog mappings"
on public.pos_catalog_item_mappings for select
to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Members can read recipe versions"
on public.recipe_versions for select
to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Members can read recipe ingredients"
on public.recipe_ingredients for select
to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Members can read modifier recipe adjustments"
on public.modifier_recipe_adjustments for select
to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Members can read ingredient substitutions"
on public.ingredient_substitutions for select
to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Members can read inventory events"
on public.inventory_events for select
to authenticated
using (private.is_restaurant_member(restaurant_id));

revoke all on public.system_operational_controls from anon, authenticated;
revoke all on public.restaurant_operational_controls from anon, authenticated;
revoke all on public.pos_locations from anon, authenticated;
revoke all on public.menu_items from anon, authenticated;
revoke all on public.pos_catalog_item_mappings from anon, authenticated;
revoke all on public.recipe_versions from anon, authenticated;
revoke all on public.recipe_ingredients from anon, authenticated;
revoke all on public.modifier_recipe_adjustments from anon, authenticated;
revoke all on public.ingredient_substitutions from anon, authenticated;
revoke all on public.inventory_events from anon, authenticated;

grant select on public.system_operational_controls to authenticated;
grant select, update on public.restaurant_operational_controls to authenticated;
grant select on public.pos_locations to authenticated;
grant select on public.menu_items to authenticated;
grant select on public.pos_catalog_item_mappings to authenticated;
grant select on public.recipe_versions to authenticated;
grant select on public.recipe_ingredients to authenticated;
grant select on public.modifier_recipe_adjustments to authenticated;
grant select on public.ingredient_substitutions to authenticated;
grant select on public.inventory_events to authenticated;

revoke all on function public.record_inventory_event(
  uuid, uuid, text, numeric, text, timestamptz, text, text, text, text, text, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.record_inventory_event(
  uuid, uuid, text, numeric, text, timestamptz, text, text, text, text, text, uuid, jsonb
) to authenticated;

grant all on public.system_operational_controls to service_role;
grant all on public.restaurant_operational_controls to service_role;
grant all on public.pos_locations to service_role;
grant all on public.menu_items to service_role;
grant all on public.pos_catalog_item_mappings to service_role;
grant all on public.recipe_versions to service_role;
grant all on public.recipe_ingredients to service_role;
grant all on public.modifier_recipe_adjustments to service_role;
grant all on public.ingredient_substitutions to service_role;
grant all on public.inventory_events to service_role;
grant usage, select on sequence public.inventory_events_sequence_seq to service_role;
