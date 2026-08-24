-- MISE-003C: supplier names remain human-readable snapshots, while every new
-- purchasing and supplier-send authority boundary uses a durable tenant-scoped
-- UUID. Exact normalized-name equality is used only by this additive backfill
-- and by controlled setup creation; it is never a runtime authority fallback.

create or replace function private.normalize_supplier_display_name(p_name text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select nullif(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(p_name, '[[:space:]]+', ' ', 'g')
    ),
    ''
  );
$$;

create or replace function private.normalize_supplier_name(p_name text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select pg_catalog.lower(private.normalize_supplier_display_name(p_name));
$$;

revoke all on function private.normalize_supplier_display_name(text)
from public, anon, authenticated, service_role;
revoke all on function private.normalize_supplier_name(text)
from public, anon, authenticated, service_role;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  display_name text not null,
  normalized_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_restaurant_id_id_key unique (restaurant_id, id),
  constraint suppliers_restaurant_normalized_name_key unique (restaurant_id, normalized_name),
  constraint suppliers_display_name_check check (
    pg_catalog.length(display_name) between 1 and 160
    and display_name = private.normalize_supplier_display_name(display_name)
    and display_name !~ '[[:cntrl:]]'
    and normalized_name = private.normalize_supplier_name(display_name)
  )
);

comment on table public.suppliers is
  'Durable tenant-scoped supplier identity. display_name may change; id is purchasing and delivery authority.';
comment on column public.suppliers.normalized_name is
  'Deterministic setup/backfill and duplicate-discovery key only. Runtime authority must use supplier id.';

create trigger set_suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;

create policy "Members can read suppliers"
on public.suppliers for select to authenticated
using (private.is_restaurant_member(restaurant_id));

revoke all on table public.suppliers from public, anon, authenticated, service_role;
grant select on table public.suppliers to authenticated;

alter table public.inventory_items add column supplier_id uuid;
alter table public.purchase_recommendations add column supplier_id uuid;
alter table public.supplier_orders add column supplier_id uuid;
alter table public.supplier_recipients add column supplier_id uuid;
alter table public.supplier_items add column supplier_id uuid;
alter table public.purchase_orders add column supplier_id uuid;
alter table public.restaurant_autonomy_rules add column supplier_id uuid;
alter table private.supplier_email_deliveries add column supplier_id uuid;

-- Retained so an upgrade can be proven after all migrations have applied. It
-- is migration infrastructure only and is revoked from every application role.
create or replace function private.backfill_durable_supplier_identity()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  unresolved_required_count integer;
  duplicate_draft_count integer;
  duplicate_rule_count integer;
begin
  select count(*) into unresolved_required_count
  from (
    select inventory.restaurant_id, inventory.id, inventory.supplier_name
    from public.inventory_items inventory
    union all
    select recommendation.restaurant_id, recommendation.id, recommendation.supplier_name
    from public.purchase_recommendations recommendation
    union all
    select orders.restaurant_id, orders.id, orders.supplier_name
    from public.supplier_orders orders
    union all
    select recipient.restaurant_id, recipient.id, recipient.supplier_name
    from public.supplier_recipients recipient
  ) required_source
  where private.normalize_supplier_display_name(required_source.supplier_name) is null
    or pg_catalog.length(private.normalize_supplier_display_name(required_source.supplier_name)) > 160
    or required_source.supplier_name ~ '[[:cntrl:]]';

  if unresolved_required_count > 0 then
    raise exception 'MISE-003C cannot safely establish % required supplier identities',
      unresolved_required_count using errcode = '23514';
  end if;

  with supplier_sources as (
    select recipient.restaurant_id,
      private.normalize_supplier_display_name(recipient.supplier_name) as display_name,
      private.normalize_supplier_name(recipient.supplier_name) as normalized_name,
      1 as source_rank, recipient.id::text as stable_id
    from public.supplier_recipients recipient
    union all
    select inventory.restaurant_id,
      private.normalize_supplier_display_name(inventory.supplier_name),
      private.normalize_supplier_name(inventory.supplier_name),
      2, inventory.id::text
    from public.inventory_items inventory
    union all
    select recommendation.restaurant_id,
      private.normalize_supplier_display_name(recommendation.supplier_name),
      private.normalize_supplier_name(recommendation.supplier_name),
      3, recommendation.id::text
    from public.purchase_recommendations recommendation
    union all
    select orders.restaurant_id,
      private.normalize_supplier_display_name(orders.supplier_name),
      private.normalize_supplier_name(orders.supplier_name),
      4, orders.id::text
    from public.supplier_orders orders
    union all
    select item.restaurant_id,
      private.normalize_supplier_display_name(item.supplier_name),
      private.normalize_supplier_name(item.supplier_name),
      5, item.id::text
    from public.supplier_items item
    union all
    select purchase_order.restaurant_id,
      private.normalize_supplier_display_name(purchase_order.supplier_name),
      private.normalize_supplier_name(purchase_order.supplier_name),
      6, purchase_order.id::text
    from public.purchase_orders purchase_order
    union all
    select rule.restaurant_id,
      private.normalize_supplier_display_name(rule.supplier_name),
      private.normalize_supplier_name(rule.supplier_name),
      7, rule.id::text
    from public.restaurant_autonomy_rules rule
    where rule.supplier_name is not null
  ), canonical_sources as (
    select distinct on (source.restaurant_id, source.normalized_name)
      source.restaurant_id, source.display_name, source.normalized_name
    from supplier_sources source
    where source.display_name is not null
      and pg_catalog.length(source.display_name) between 1 and 160
      and source.display_name !~ '[[:cntrl:]]'
    order by source.restaurant_id, source.normalized_name,
      source.source_rank, source.display_name collate "C", source.stable_id
  )
  insert into public.suppliers (restaurant_id, display_name, normalized_name)
  select source.restaurant_id, source.display_name, source.normalized_name
  from canonical_sources source
  on conflict (restaurant_id, normalized_name) do nothing;

  update public.inventory_items row
  set supplier_id = supplier.id
  from public.suppliers supplier
  where supplier.restaurant_id = row.restaurant_id
    and supplier.normalized_name = private.normalize_supplier_name(row.supplier_name)
    and row.supplier_id is null;

  update public.purchase_recommendations row
  set supplier_id = supplier.id
  from public.suppliers supplier
  where supplier.restaurant_id = row.restaurant_id
    and supplier.normalized_name = private.normalize_supplier_name(row.supplier_name)
    and row.supplier_id is null;

  update public.supplier_orders row
  set supplier_id = supplier.id
  from public.suppliers supplier
  where supplier.restaurant_id = row.restaurant_id
    and supplier.normalized_name = private.normalize_supplier_name(row.supplier_name)
    and row.supplier_id is null;

  update public.supplier_recipients row
  set supplier_id = supplier.id
  from public.suppliers supplier
  where supplier.restaurant_id = row.restaurant_id
    and supplier.normalized_name = private.normalize_supplier_name(row.supplier_name)
    and row.supplier_id is null;

  update public.supplier_items row
  set supplier_id = supplier.id
  from public.suppliers supplier
  where supplier.restaurant_id = row.restaurant_id
    and supplier.normalized_name = private.normalize_supplier_name(row.supplier_name)
    and row.supplier_id is null;

  update public.purchase_orders row
  set supplier_id = supplier.id
  from public.suppliers supplier
  where supplier.restaurant_id = row.restaurant_id
    and supplier.normalized_name = private.normalize_supplier_name(row.supplier_name)
    and row.supplier_id is null;

  update public.restaurant_autonomy_rules row
  set supplier_id = supplier.id
  from public.suppliers supplier
  where supplier.restaurant_id = row.restaurant_id
    and supplier.normalized_name = private.normalize_supplier_name(row.supplier_name)
    and row.supplier_id is null;

  select count(*) into unresolved_required_count
  from (
    select supplier_id from public.inventory_items
    union all select supplier_id from public.purchase_recommendations
    union all select supplier_id from public.supplier_orders
    union all select supplier_id from public.supplier_recipients
  ) required_identity
  where required_identity.supplier_id is null;
  if unresolved_required_count > 0 then
    raise exception 'MISE-003C left % required supplier identities unresolved',
      unresolved_required_count using errcode = '23514';
  end if;

  select count(*) into duplicate_draft_count
  from (
    select orders.restaurant_id, orders.supplier_id
    from public.supplier_orders orders
    where orders.status = 'draft'
    group by orders.restaurant_id, orders.supplier_id
    having count(*) > 1
  ) duplicate_drafts;
  if duplicate_draft_count > 0 then
    raise exception 'MISE-003C found normalized supplier draft collisions; manual review is required'
      using errcode = '23505';
  end if;

  select count(*) into duplicate_rule_count
  from (
    select rule.restaurant_id, rule.location_id, rule.action_type,
      rule.supplier_id, rule.communication_type
    from public.restaurant_autonomy_rules rule
    group by rule.restaurant_id, rule.location_id, rule.action_type,
      rule.supplier_id, rule.communication_type
    having count(*) > 1
  ) duplicate_rules;
  if duplicate_rule_count > 0 then
    raise exception 'MISE-003C found normalized supplier autonomy-rule collisions; manual review is required'
      using errcode = '23505';
  end if;

  return jsonb_build_object(
    'supplierCount', (select count(*) from public.suppliers),
    'inventoryItemCount', (select count(*) from public.inventory_items where supplier_id is not null),
    'recommendationCount', (select count(*) from public.purchase_recommendations where supplier_id is not null),
    'orderCount', (select count(*) from public.supplier_orders where supplier_id is not null),
    'recipientCount', (select count(*) from public.supplier_recipients where supplier_id is not null)
  );
end;
$$;

revoke all on function private.backfill_durable_supplier_identity()
from public, anon, authenticated, service_role;

-- Avoid staling planning evidence merely because the additive identity column
-- was populated. Reassignment later uses the normal trigger intentionally.
alter table public.inventory_items disable trigger inventory_items_bump_planning_revision;
select private.backfill_durable_supplier_identity();
alter table public.inventory_items enable trigger inventory_items_bump_planning_revision;

alter table public.inventory_items alter column supplier_id set not null;
alter table public.purchase_recommendations alter column supplier_id set not null;
alter table public.supplier_orders alter column supplier_id set not null;
alter table public.supplier_recipients alter column supplier_id set not null;

alter table public.inventory_items
  add constraint inventory_items_supplier_tenant_fkey
  foreign key (restaurant_id, supplier_id)
  references public.suppliers(restaurant_id, id)
  on delete no action deferrable initially deferred;
alter table public.purchase_recommendations
  add constraint purchase_recommendations_supplier_tenant_fkey
  foreign key (restaurant_id, supplier_id)
  references public.suppliers(restaurant_id, id)
  on delete no action deferrable initially deferred;
alter table public.supplier_orders
  add constraint supplier_orders_supplier_tenant_fkey
  foreign key (restaurant_id, supplier_id)
  references public.suppliers(restaurant_id, id)
  on delete no action deferrable initially deferred;
alter table public.supplier_recipients
  add constraint supplier_recipients_supplier_tenant_fkey
  foreign key (restaurant_id, supplier_id)
  references public.suppliers(restaurant_id, id)
  on delete no action deferrable initially deferred;
alter table public.supplier_items
  add constraint supplier_items_supplier_tenant_fkey
  foreign key (restaurant_id, supplier_id)
  references public.suppliers(restaurant_id, id)
  on delete no action deferrable initially deferred;
alter table public.purchase_orders
  add constraint purchase_orders_supplier_tenant_fkey
  foreign key (restaurant_id, supplier_id)
  references public.suppliers(restaurant_id, id)
  on delete no action deferrable initially deferred;
alter table public.restaurant_autonomy_rules
  add constraint restaurant_autonomy_rules_supplier_tenant_fkey
  foreign key (restaurant_id, supplier_id)
  references public.suppliers(restaurant_id, id)
  on delete no action deferrable initially deferred;
alter table private.supplier_email_deliveries
  add constraint supplier_email_deliveries_supplier_tenant_fkey
  foreign key (restaurant_id, supplier_id)
  references public.suppliers(restaurant_id, id)
  on delete no action deferrable initially deferred;

-- These legacy/select-only tables keep malformed historical rows readable,
-- while every new or updated supplier-bearing row must provide a durable ID.
alter table public.supplier_items
  add constraint supplier_items_supplier_id_required_check
  check (supplier_id is not null) not valid;
alter table public.purchase_orders
  add constraint purchase_orders_supplier_id_required_check
  check (supplier_id is not null) not valid;
alter table public.restaurant_autonomy_rules
  add constraint restaurant_autonomy_rules_supplier_scope_check
  check ((supplier_name is null) = (supplier_id is null)) not valid;

drop index if exists public.supplier_orders_draft_supplier_idx;
create unique index supplier_orders_draft_supplier_id_idx
on public.supplier_orders(restaurant_id, supplier_id)
where status = 'draft';

drop index if exists public.supplier_recipients_restaurant_normalized_supplier_uidx;
create unique index supplier_recipients_restaurant_supplier_id_uidx
on public.supplier_recipients(restaurant_id, supplier_id);

alter table public.restaurant_autonomy_rules
  drop constraint restaurant_autonomy_rules_scope_key;
alter table public.restaurant_autonomy_rules
  add constraint restaurant_autonomy_rules_scope_key
  unique nulls not distinct (
    restaurant_id, location_id, action_type, supplier_id, communication_type
  );

create index suppliers_restaurant_display_idx
on public.suppliers(restaurant_id, normalized_name, id);
create index inventory_items_restaurant_supplier_id_idx
on public.inventory_items(restaurant_id, supplier_id);
create index purchase_recommendations_restaurant_supplier_id_idx
on public.purchase_recommendations(restaurant_id, supplier_id, status);
create index supplier_orders_restaurant_supplier_id_idx
on public.supplier_orders(restaurant_id, supplier_id, created_at desc);
create index supplier_items_restaurant_supplier_id_idx
on public.supplier_items(restaurant_id, supplier_id);
create index purchase_orders_restaurant_supplier_id_idx
on public.purchase_orders(restaurant_id, supplier_id);

comment on column public.inventory_items.supplier_id is
  'Durable purchasing supplier authority. supplier_name is a retained display snapshot.';
comment on column public.purchase_recommendations.supplier_id is
  'Supplier identity copied server-side from the tenant-scoped inventory item.';
comment on column public.supplier_orders.supplier_id is
  'Stable draft grouping, recipient, lock, and send authority identity.';
comment on column public.supplier_recipients.supplier_id is
  'Stable recipient association; supplier_name is presentation only.';
comment on column private.supplier_email_deliveries.supplier_id is
  'Exact supplier identity for v2 claims. Null is retained only for historical v1 proof.';

-- A supplier UUID, scoped by its restaurant, is the one serialization domain
-- for purchasing, draft mutation, reviewed content, and provider delivery.
create or replace function private.lock_supplier_authority(
  p_restaurant_id uuid,
  p_supplier_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_restaurant_id is null or p_supplier_id is null or not exists (
    select 1 from public.suppliers supplier
    where supplier.restaurant_id = p_restaurant_id
      and supplier.id = p_supplier_id
  ) then
    raise exception 'Supplier identity is not valid for this restaurant'
      using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'mise:supplier:' || p_restaurant_id::text || E'\x1f' || p_supplier_id::text,
    0
  ));
end;
$$;

create or replace function private.try_lock_supplier_authority(
  p_restaurant_id uuid,
  p_supplier_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select p_restaurant_id is not null
    and p_supplier_id is not null
    and exists (
      select 1 from public.suppliers supplier
      where supplier.restaurant_id = p_restaurant_id
        and supplier.id = p_supplier_id
    )
    and pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(
      'mise:supplier:' || p_restaurant_id::text || E'\x1f' || p_supplier_id::text,
      0
    ));
$$;

revoke all on function private.lock_supplier_authority(uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function private.try_lock_supplier_authority(uuid, uuid)
from public, anon, authenticated, service_role;

create or replace function public.create_supplier(
  p_restaurant_id uuid,
  p_display_name text
)
returns public.suppliers
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  canonical_name text := private.normalize_supplier_display_name(p_display_name);
  supplier_row public.suppliers%rowtype;
begin
  if actor_user_id is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if canonical_name is null or pg_catalog.length(canonical_name) > 160
    or coalesce(p_display_name, '') ~ '[[:cntrl:]]'
  then
    raise exception 'Supplier name must be between 1 and 160 characters without control characters'
      using errcode = '22023';
  end if;

  insert into public.suppliers (restaurant_id, display_name, normalized_name)
  values (p_restaurant_id, canonical_name, private.normalize_supplier_name(canonical_name))
  returning * into supplier_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, actor_user_id, 'supplier_created', 'suppliers', supplier_row.id,
    pg_catalog.jsonb_build_object(
      'supplier_id', supplier_row.id,
      'display_name', supplier_row.display_name
    )
  );
  return supplier_row;
exception when unique_violation then
  raise exception 'A supplier with this exact normalized name already exists'
    using errcode = '23505';
end;
$$;

revoke all on function public.create_supplier(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.create_supplier(uuid, text) to authenticated;

-- External identity fields contribute to the exact reviewed message. This
-- helper advances per-draft content revisions by stable supplier ID. Active
-- claims retain immutable headers/content and only record that live identity
-- changed while the provider outcome was unresolved.
create or replace function private.bump_supplier_send_revision_for_external_identity(
  p_restaurant_id uuid,
  p_supplier_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_supplier_id uuid;
begin
  if p_restaurant_id is null then return; end if;

  update private.supplier_email_deliveries delivery
  set external_identity_changed_during_claim = true,
    updated_at = pg_catalog.now()
  where delivery.restaurant_id = p_restaurant_id
    and delivery.status in ('sending', 'unknown')
    and exists (
      select 1 from public.supplier_orders orders
      where orders.restaurant_id = delivery.restaurant_id
        and orders.id = delivery.supplier_order_id
        and orders.status = 'draft'
        and (p_supplier_ids is null or orders.supplier_id = any(p_supplier_ids))
    );

  for candidate_supplier_id in
    select distinct orders.supplier_id
    from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.status = 'draft'
      and (p_supplier_ids is null or orders.supplier_id = any(p_supplier_ids))
      and not exists (
        select 1 from private.supplier_email_deliveries delivery
        where delivery.restaurant_id = orders.restaurant_id
          and delivery.supplier_order_id = orders.id
          and delivery.status in ('sending', 'unknown')
      )
    order by orders.supplier_id
  loop
    if not private.try_lock_supplier_authority(p_restaurant_id, candidate_supplier_id) then
      raise exception 'Supplier send identity changed concurrently; retry'
        using errcode = '40001';
    end if;
  end loop;

  update public.supplier_orders orders
  set send_content_revision = orders.send_content_revision + 1
  where orders.restaurant_id = p_restaurant_id
    and orders.status = 'draft'
    and (p_supplier_ids is null or orders.supplier_id = any(p_supplier_ids))
    and not exists (
      select 1 from private.supplier_email_deliveries delivery
      where delivery.restaurant_id = orders.restaurant_id
        and delivery.supplier_order_id = orders.id
        and delivery.status in ('sending', 'unknown')
    );
end;
$$;

revoke all on function private.bump_supplier_send_revision_for_external_identity(uuid, uuid[])
from public, anon, authenticated, service_role;

create or replace function private.invalidate_supplier_send_for_gmail_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.provider = 'gmail' then
      perform private.bump_supplier_send_revision_for_external_identity(
        old.restaurant_id, null::uuid[]
      );
    end if;
    return old;
  elsif tg_op = 'INSERT' then
    if new.provider = 'gmail' then
      perform private.bump_supplier_send_revision_for_external_identity(
        new.restaurant_id, null::uuid[]
      );
    end if;
    return new;
  end if;

  if old.restaurant_id is not distinct from new.restaurant_id
    and old.provider is not distinct from new.provider
    and old.status is not distinct from new.status
    and old.sender_email is not distinct from new.sender_email
  then return new; end if;
  if old.provider = 'gmail' then
    perform private.bump_supplier_send_revision_for_external_identity(
      old.restaurant_id, null::uuid[]
    );
  end if;
  if new.provider = 'gmail' and (
    old.provider is distinct from 'gmail'
    or old.restaurant_id is distinct from new.restaurant_id
  ) then
    perform private.bump_supplier_send_revision_for_external_identity(
      new.restaurant_id, null::uuid[]
    );
  end if;
  return new;
end;
$$;

create or replace function private.invalidate_supplier_send_for_recipient_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.bump_supplier_send_revision_for_external_identity(
      old.restaurant_id, array[old.supplier_id]
    );
    return old;
  elsif tg_op = 'INSERT' then
    perform private.bump_supplier_send_revision_for_external_identity(
      new.restaurant_id, array[new.supplier_id]
    );
    return new;
  end if;
  if old.restaurant_id is not distinct from new.restaurant_id
    and old.supplier_id is not distinct from new.supplier_id
    and old.email is not distinct from new.email
  then return new; end if;
  perform private.bump_supplier_send_revision_for_external_identity(
    old.restaurant_id, array[old.supplier_id]
  );
  if old.restaurant_id is distinct from new.restaurant_id
    or old.supplier_id is distinct from new.supplier_id
  then
    perform private.bump_supplier_send_revision_for_external_identity(
      new.restaurant_id, array[new.supplier_id]
    );
  end if;
  return new;
end;
$$;

create or replace function private.invalidate_supplier_send_for_restaurant_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.name is distinct from new.name then
    perform private.bump_supplier_send_revision_for_external_identity(
      new.id, null::uuid[]
    );
  end if;
  return new;
end;
$$;

revoke all on function private.invalidate_supplier_send_for_gmail_identity()
from public, anon, authenticated, service_role;
revoke all on function private.invalidate_supplier_send_for_recipient_identity()
from public, anon, authenticated, service_role;
revoke all on function private.invalidate_supplier_send_for_restaurant_name()
from public, anon, authenticated, service_role;

create or replace function public.upsert_supplier_recipient(
  p_restaurant_id uuid,
  p_supplier_id uuid,
  p_email text
)
returns public.supplier_recipients
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  supplier_row public.suppliers%rowtype;
  recipient_row public.supplier_recipients%rowtype;
  audit_action text;
  changed boolean := false;
begin
  if actor_user_id is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if pg_catalog.length(normalized_email) not between 3 and 254
    or normalized_email ~ '[[:cntrl:]]'
    or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then
    raise exception 'Supplier email address is invalid' using errcode = '22023';
  end if;

  perform private.lock_supplier_authority(p_restaurant_id, p_supplier_id);
  select * into supplier_row from public.suppliers supplier
  where supplier.restaurant_id = p_restaurant_id and supplier.id = p_supplier_id
  for update;

  select * into recipient_row from public.supplier_recipients recipient
  where recipient.restaurant_id = p_restaurant_id
    and recipient.supplier_id = p_supplier_id
  for update;
  if found then
    changed := recipient_row.email is distinct from normalized_email
      or recipient_row.supplier_name is distinct from supplier_row.display_name;
    if changed then
      update public.supplier_recipients recipient
      set email = normalized_email,
        supplier_name = supplier_row.display_name
      where recipient.restaurant_id = p_restaurant_id
        and recipient.supplier_id = p_supplier_id
      returning * into recipient_row;
      audit_action := 'supplier_recipient_updated';
    end if;
  else
    insert into public.supplier_recipients (
      restaurant_id, supplier_id, supplier_name, email
    ) values (
      p_restaurant_id, p_supplier_id, supplier_row.display_name, normalized_email
    ) returning * into recipient_row;
    changed := true;
    audit_action := 'supplier_recipient_created';
  end if;

  if changed then
    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id, actor_user_id, audit_action,
      'supplier_recipients', recipient_row.id,
      pg_catalog.jsonb_build_object(
        'supplier_id', p_supplier_id,
        'supplier_name', supplier_row.display_name,
        'email_configured', true
      )
    );
  end if;
  return recipient_row;
end;
$$;

revoke all on function public.upsert_supplier_recipient(uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.upsert_supplier_recipient(uuid, uuid, text)
to authenticated;
revoke all on function public.upsert_supplier_recipient(uuid, text, text)
from public, anon, authenticated, service_role;

create or replace function public.rename_supplier(
  p_restaurant_id uuid,
  p_supplier_id uuid,
  p_display_name text
)
returns public.suppliers
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  canonical_name text := private.normalize_supplier_display_name(p_display_name);
  supplier_row public.suppliers%rowtype;
  previous_name text;
begin
  if actor_user_id is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if canonical_name is null or pg_catalog.length(canonical_name) > 160
    or coalesce(p_display_name, '') ~ '[[:cntrl:]]'
  then
    raise exception 'Supplier name must be between 1 and 160 characters without control characters'
      using errcode = '22023';
  end if;

  perform private.lock_supplier_authority(p_restaurant_id, p_supplier_id);
  select * into supplier_row from public.suppliers supplier
  where supplier.restaurant_id = p_restaurant_id and supplier.id = p_supplier_id
  for update;
  if not found then raise exception 'Supplier not found' using errcode = 'P0002'; end if;
  previous_name := supplier_row.display_name;
  if previous_name = canonical_name then return supplier_row; end if;

  -- Match the claim lock order before changing any reviewed presentation.
  perform 1 from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.idempotency_key in (
      select pg_catalog.format('send_supplier_order:%s', orders.id)
      from public.supplier_orders orders
      where orders.restaurant_id = p_restaurant_id
        and orders.supplier_id = p_supplier_id
        and orders.status = 'draft'
    )
  order by action.id for update;
  perform 1 from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id
    and orders.supplier_id = p_supplier_id
    and orders.status = 'draft'
  order by orders.id for update;
  perform 1 from private.supplier_email_deliveries delivery
  where delivery.restaurant_id = p_restaurant_id
    and exists (
      select 1 from public.supplier_orders orders
      where orders.restaurant_id = delivery.restaurant_id
        and orders.id = delivery.supplier_order_id
        and orders.supplier_id = p_supplier_id
    )
  order by delivery.id for update;

  update public.suppliers supplier
  set display_name = canonical_name,
    normalized_name = private.normalize_supplier_name(canonical_name)
  where supplier.restaurant_id = p_restaurant_id and supplier.id = p_supplier_id
  returning * into supplier_row;

  -- Current catalog/recipient presentation follows the rename. Inventory's
  -- old supplier_name remains a display snapshot so identity-only rename does
  -- not spuriously advance purchasing planning evidence.
  update public.supplier_recipients recipient
  set supplier_name = canonical_name
  where recipient.restaurant_id = p_restaurant_id
    and recipient.supplier_id = p_supplier_id;

  update public.purchase_recommendations recommendation
  set supplier_name = canonical_name
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_id = p_supplier_id
    and recommendation.status <> 'ordered'
    and (
      recommendation.supplier_order_id is null
      or not exists (
        select 1 from private.supplier_email_deliveries delivery
        where delivery.restaurant_id = recommendation.restaurant_id
          and delivery.supplier_order_id = recommendation.supplier_order_id
          and delivery.status in ('sending', 'unknown')
      )
    );

  update public.supplier_orders orders
  set supplier_name = canonical_name
  where orders.restaurant_id = p_restaurant_id
    and orders.supplier_id = p_supplier_id
    and orders.status = 'draft'
    and not exists (
      select 1 from private.supplier_email_deliveries delivery
      where delivery.restaurant_id = orders.restaurant_id
        and delivery.supplier_order_id = orders.id
        and delivery.status in ('sending', 'unknown')
    );
  update public.supplier_orders orders
  set order_message = private.build_supplier_order_message(
    p_restaurant_id, orders.id, orders.supplier_name, orders.operator_note
  )
  where orders.restaurant_id = p_restaurant_id
    and orders.supplier_id = p_supplier_id
    and orders.status = 'draft'
    and not exists (
      select 1 from private.supplier_email_deliveries delivery
      where delivery.restaurant_id = orders.restaurant_id
        and delivery.supplier_order_id = orders.id
        and delivery.status in ('sending', 'unknown')
    );

  update private.supplier_email_deliveries delivery
  set external_identity_changed_during_claim = true,
    updated_at = pg_catalog.now()
  where delivery.restaurant_id = p_restaurant_id
    and delivery.status in ('sending', 'unknown')
    and exists (
      select 1 from public.supplier_orders orders
      where orders.restaurant_id = delivery.restaurant_id
        and orders.id = delivery.supplier_order_id
        and orders.supplier_id = p_supplier_id
    );

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, actor_user_id, 'supplier_renamed', 'suppliers', p_supplier_id,
    pg_catalog.jsonb_build_object(
      'supplier_id', p_supplier_id,
      'previous_display_name', previous_name,
      'display_name', canonical_name
    )
  );
  return supplier_row;
exception when unique_violation then
  raise exception 'A supplier with this exact normalized name already exists'
    using errcode = '23505';
end;
$$;

revoke all on function public.rename_supplier(uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.rename_supplier(uuid, uuid, text)
to authenticated;

create or replace function public.reassign_inventory_item_supplier(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_supplier_id uuid
)
returns public.inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  item_snapshot public.inventory_items%rowtype;
  item_row public.inventory_items%rowtype;
  supplier_row public.suppliers%rowtype;
  lock_supplier_id uuid;
  removed_pending_count integer := 0;
begin
  if actor_user_id is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  select * into item_snapshot from public.inventory_items item
  where item.restaurant_id = p_restaurant_id and item.id = p_inventory_item_id;
  if not found then raise exception 'Inventory item not found' using errcode = 'P0002'; end if;

  for lock_supplier_id in
    select distinct candidate.id
    from unnest(array[item_snapshot.supplier_id, p_supplier_id]) candidate(id)
    where candidate.id is not null
    order by candidate.id
  loop
    perform private.lock_supplier_authority(p_restaurant_id, lock_supplier_id);
  end loop;

  select * into item_row from public.inventory_items item
  where item.restaurant_id = p_restaurant_id and item.id = p_inventory_item_id
  for update;
  if item_row.supplier_id is distinct from item_snapshot.supplier_id then
    raise exception 'Supplier assignment changed concurrently; retry' using errcode = '40001';
  end if;
  select * into supplier_row from public.suppliers supplier
  where supplier.restaurant_id = p_restaurant_id and supplier.id = p_supplier_id
  for share;
  if not found then
    raise exception 'Supplier identity is not valid for this restaurant' using errcode = '22023';
  end if;
  if item_row.supplier_id = p_supplier_id then return item_row; end if;

  if exists (
    select 1 from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.inventory_item_id = p_inventory_item_id
      and recommendation.status in ('approved', 'ordered')
  ) then
    raise exception 'Undo or finish existing supplier purchasing before reassignment'
      using errcode = '55000';
  end if;

  delete from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.inventory_item_id = p_inventory_item_id
    and recommendation.status = 'pending';
  get diagnostics removed_pending_count = row_count;

  update public.inventory_items item
  set supplier_id = p_supplier_id,
    supplier_name = supplier_row.display_name
  where item.restaurant_id = p_restaurant_id and item.id = p_inventory_item_id
  returning * into item_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, actor_user_id, 'inventory_supplier_reassigned',
    'inventory_items', p_inventory_item_id,
    pg_catalog.jsonb_build_object(
      'previous_supplier_id', item_snapshot.supplier_id,
      'supplier_id', p_supplier_id,
      'invalidated_pending_recommendation_count', removed_pending_count
    )
  );
  return item_row;
end;
$$;

revoke all on function public.reassign_inventory_item_supplier(uuid, uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.reassign_inventory_item_supplier(uuid, uuid, uuid)
to authenticated;

-- Preserve the complete reviewed MISE-003A evidence evaluator, but replace its
-- three display-name supplier blockers with equivalent durable-ID proof. The
-- legacy function is private/revoked and cannot establish supplier authority.
alter function private.evaluate_purchase_recommendation_authority_mise_003a_base(
  uuid, uuid, timestamptz
) rename to evaluate_purchase_recommendation_authority_mise_003a_name_base;

revoke all on function private.evaluate_purchase_recommendation_authority_mise_003a_name_base(
  uuid, uuid, timestamptz
) from public, anon, authenticated, service_role;

create or replace function private.evaluate_purchase_recommendation_authority_mise_003a_base(
  p_restaurant_id uuid,
  p_recommendation_id uuid,
  p_evaluated_at timestamptz default pg_catalog.clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authority jsonb;
  blockers jsonb;
  evidence jsonb;
  recommendation_row public.purchase_recommendations%rowtype;
  item_row public.inventory_items%rowtype;
  linked_order public.supplier_orders%rowtype;
  draft_authority_order_id uuid;
  draft_authority_gap_count integer := 0;
begin
  authority := private.evaluate_purchase_recommendation_authority_mise_003a_name_base(
    p_restaurant_id, p_recommendation_id, p_evaluated_at
  );

  select coalesce(pg_catalog.jsonb_agg(filtered.value order by filtered.ordinality), '[]'::jsonb)
  into blockers
  from pg_catalog.jsonb_array_elements(coalesce(authority->'blockers', '[]'::jsonb))
    with ordinality as filtered(value, ordinality)
  where filtered.value->>'code' not in (
    'supplier_missing', 'supplier_mismatch', 'draft_authority_incomplete'
  );
  evidence := coalesce(authority->'evidence', '{}'::jsonb);

  select * into recommendation_row
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id;
  if not found then
    raise exception 'Recommendation not found' using errcode = '22023';
  end if;
  select * into item_row
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id
    and item.id = recommendation_row.inventory_item_id;

  if recommendation_row.supplier_id is null
    or (item_row.id is not null and item_row.supplier_id is null)
    or not exists (
      select 1 from public.suppliers supplier
      where supplier.restaurant_id = p_restaurant_id
        and supplier.id = recommendation_row.supplier_id
    )
  then
    blockers := private.append_purchase_authority_blocker(
      blockers, 'supplier_missing',
      'This item needs a durable same-restaurant supplier before approval.',
      pg_catalog.jsonb_build_object('supplierId', recommendation_row.supplier_id)
    );
  elsif item_row.id is not null
    and recommendation_row.supplier_id is distinct from item_row.supplier_id
  then
    blockers := private.append_purchase_authority_blocker(
      blockers, 'supplier_mismatch',
      'The recommendation supplier identity no longer matches the inventory item supplier identity.',
      pg_catalog.jsonb_build_object(
        'recommendationSupplierId', recommendation_row.supplier_id,
        'inventorySupplierId', item_row.supplier_id
      )
    );
  end if;

  if recommendation_row.supplier_order_id is not null then
    select * into linked_order
    from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.id = recommendation_row.supplier_order_id;
    if linked_order.id is null
      or linked_order.status <> 'draft'
      or linked_order.supplier_id is distinct from recommendation_row.supplier_id
    then
      blockers := private.append_purchase_authority_blocker(
        blockers, 'supplier_mismatch',
        'The linked supplier draft no longer matches this recommendation supplier identity.',
        pg_catalog.jsonb_build_object(
          'recommendationSupplierId', recommendation_row.supplier_id,
          'orderSupplierId', linked_order.supplier_id
        )
      );
    else
      draft_authority_order_id := linked_order.id;
    end if;
  elsif recommendation_row.supplier_id is not null then
    select orders.id into draft_authority_order_id
    from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.supplier_id = recommendation_row.supplier_id
      and orders.status = 'draft'
    order by orders.created_at desc, orders.id desc
    limit 1;
  end if;

  if draft_authority_order_id is not null then
    select count(*) into draft_authority_gap_count
    from public.purchase_recommendations existing_line
    join public.supplier_orders existing_order
      on existing_order.restaurant_id = p_restaurant_id
      and existing_order.id = draft_authority_order_id
      and existing_order.supplier_id = recommendation_row.supplier_id
    where existing_line.restaurant_id = p_restaurant_id
      and existing_line.supplier_order_id = draft_authority_order_id
      and existing_line.status = 'approved'
      and (
        existing_line.supplier_id is distinct from existing_order.supplier_id
        or coalesce(pg_catalog.jsonb_typeof(existing_line.approval_authority), 'null') <> 'object'
        or coalesce(existing_line.approval_authority->>'ready', 'false') <> 'true'
        or not coalesce(existing_order.purchase_authority ? existing_line.id::text, false)
        or existing_order.purchase_authority->existing_line.id::text
          is distinct from existing_line.approval_authority
      );
    if draft_authority_gap_count > 0 then
      blockers := private.append_purchase_authority_blocker(
        blockers, 'draft_authority_incomplete',
        'This supplier draft contains an approved line without durable supplier purchase authority.',
        pg_catalog.jsonb_build_object(
          'supplierOrderId', draft_authority_order_id,
          'supplierId', recommendation_row.supplier_id,
          'unattestedLineCount', draft_authority_gap_count
        )
      );
    end if;
  end if;

  evidence := evidence || pg_catalog.jsonb_build_object(
    'supplierId', recommendation_row.supplier_id,
    'inventorySupplierId', item_row.supplier_id,
    'supplierOrderId', draft_authority_order_id
  );
  authority := pg_catalog.jsonb_set(authority, '{blockers}', blockers, true);
  authority := pg_catalog.jsonb_set(authority, '{evidence}', evidence, true);
  authority := pg_catalog.jsonb_set(
    authority, '{ready}', pg_catalog.to_jsonb(pg_catalog.jsonb_array_length(blockers) = 0), true
  );
  return authority;
end;
$$;

revoke all on function private.evaluate_purchase_recommendation_authority_mise_003a_base(
  uuid, uuid, timestamptz
) from public, anon, authenticated, service_role;

-- Recommendation supplier authority can only originate from its inventory
-- item. A client-provided name or UUID is never accepted as an assignment.
create or replace function private.enforce_purchase_recommendation_supplier_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  authoritative_supplier_id uuid;
  authoritative_display_name text;
  order_supplier_id uuid;
begin
  select item.supplier_id, supplier.display_name
  into authoritative_supplier_id, authoritative_display_name
  from public.inventory_items item
  join public.suppliers supplier
    on supplier.restaurant_id = item.restaurant_id
    and supplier.id = item.supplier_id
  where item.restaurant_id = new.restaurant_id
    and item.id = new.inventory_item_id;
  if authoritative_supplier_id is null then
    raise exception 'Recommendation inventory supplier identity is unavailable'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.supplier_id := authoritative_supplier_id;
  elsif new.inventory_item_id is distinct from old.inventory_item_id
    or new.supplier_id is distinct from old.supplier_id
    or old.supplier_id is distinct from authoritative_supplier_id
  then
    raise exception 'Recommendation supplier identity is stale or immutable'
      using errcode = '55000';
  end if;
  new.supplier_name := authoritative_display_name;

  if new.supplier_order_id is not null then
    select orders.supplier_id into order_supplier_id
    from public.supplier_orders orders
    where orders.restaurant_id = new.restaurant_id
      and orders.id = new.supplier_order_id;
    if order_supplier_id is null
      or order_supplier_id is distinct from authoritative_supplier_id
    then
      raise exception 'Recommendation and supplier order identities do not match'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_purchase_recommendation_supplier_identity()
from public, anon, authenticated, service_role;

drop trigger if exists enforce_purchase_recommendation_supplier_identity
on public.purchase_recommendations;
create trigger enforce_purchase_recommendation_supplier_identity
before insert or update of restaurant_id, inventory_item_id, supplier_id, supplier_name, supplier_order_id
on public.purchase_recommendations
for each row execute function private.enforce_purchase_recommendation_supplier_identity();

create or replace function public.approve_purchase_recommendation_mise_003a_base(
  p_restaurant_id uuid,
  p_recommendation_id uuid,
  p_recommended_quantity numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommendation_snapshot public.purchase_recommendations%rowtype;
  recommendation_row public.purchase_recommendations%rowtype;
  order_row public.supplier_orders%rowtype;
  existing_line record;
  previous_status text;
  authority jsonb;
  existing_authority jsonb;
  evaluated_at timestamptz;
  approved_quantity numeric;
  suggested_quantity numeric;
  was_quantity_overridden boolean;
  blocker_codes jsonb;
  draft_authority_refresh jsonb := '{}'::jsonb;
  revalidated_line_count integer := 0;
  stale_line_count integer := 0;
  first_stale_line_id uuid;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if p_recommended_quantity is not null and (
    p_recommended_quantity <= 0
    or p_recommended_quantity > 1000000
    or p_recommended_quantity::text in ('NaN', 'Infinity', '-Infinity')
  ) then
    raise exception 'Enter a valid order quantity' using errcode = '22023';
  end if;

  select * into recommendation_snapshot
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id;
  if not found then raise exception 'Recommendation not found' using errcode = 'P0002'; end if;
  perform private.lock_supplier_authority(
    p_restaurant_id, recommendation_snapshot.supplier_id
  );
  select * into recommendation_row
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id
  for update;
  if recommendation_row.supplier_id is distinct from recommendation_snapshot.supplier_id then
    raise exception 'Recommendation supplier identity changed concurrently; retry'
      using errcode = '40001';
  end if;

  previous_status := recommendation_row.status;
  if recommendation_row.status in ('dismissed', 'ordered') then
    raise exception 'Already handled' using errcode = '22023';
  end if;
  if recommendation_row.status = 'approved' then
    select * into order_row
    from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.id = recommendation_row.supplier_order_id
      and orders.supplier_id = recommendation_row.supplier_id
    for update;
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_applied',
      'previous_status', previous_status,
      'recommendation', pg_catalog.to_jsonb(recommendation_row),
      'order', case when order_row.id is null then null else pg_catalog.to_jsonb(order_row) end,
      'authority', recommendation_row.approval_authority
    );
  end if;

  if recommendation_row.supplier_order_id is not null then
    select * into order_row
    from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.id = recommendation_row.supplier_order_id
      and orders.supplier_id = recommendation_row.supplier_id
    for update;
  end if;
  if order_row.id is null then
    select * into order_row
    from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.supplier_id = recommendation_row.supplier_id
      and orders.status = 'draft'
    order by orders.created_at desc, orders.id desc
    limit 1
    for update;
  end if;

  perform 1
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id
    and (
      item.id = recommendation_row.inventory_item_id
      or (
        order_row.id is not null and exists (
          select 1 from public.purchase_recommendations attached
          where attached.restaurant_id = p_restaurant_id
            and attached.supplier_order_id = order_row.id
            and attached.status = 'approved'
            and attached.inventory_item_id = item.id
        )
      )
    )
  order by item.id for update;
  perform 1 from public.system_operational_controls controls
    where controls.singleton for share;
  perform 1 from public.restaurant_operational_controls controls
    where controls.restaurant_id = p_restaurant_id for share;
  perform 1 from public.pos_integrations integration
    where integration.restaurant_id = p_restaurant_id order by integration.id for share;
  perform 1 from public.pos_locations location
    where location.restaurant_id = p_restaurant_id order by location.id for share;
  perform 1 from public.pos_catalog_item_mappings mapping
    where mapping.restaurant_id = p_restaurant_id order by mapping.id for share;
  perform 1 from public.menu_items menu_item
    where menu_item.restaurant_id = p_restaurant_id order by menu_item.id for share;
  perform 1 from public.menu_item_ingredients ingredient
    where ingredient.restaurant_id = p_restaurant_id order by ingredient.id for share;
  perform 1 from private.restaurant_signal_state state
    where state.restaurant_id = p_restaurant_id for update;

  evaluated_at := pg_catalog.clock_timestamp();
  authority := private.evaluate_purchase_recommendation_authority(
    p_restaurant_id, p_recommendation_id, evaluated_at
  );

  if coalesce((authority->>'ready')::boolean, false) and order_row.id is not null then
    for existing_line in
      select attached.id
      from public.purchase_recommendations attached
      where attached.restaurant_id = p_restaurant_id
        and attached.supplier_order_id = order_row.id
        and attached.status = 'approved'
        and attached.id <> p_recommendation_id
        and attached.supplier_id = recommendation_row.supplier_id
      order by attached.id
    loop
      existing_authority := private.evaluate_purchase_recommendation_authority(
        p_restaurant_id, existing_line.id, evaluated_at
      );
      if coalesce((existing_authority->>'ready')::boolean, false) then
        revalidated_line_count := revalidated_line_count + 1;
        draft_authority_refresh := draft_authority_refresh
          || pg_catalog.jsonb_build_object(existing_line.id::text, existing_authority);
      else
        stale_line_count := stale_line_count + 1;
        first_stale_line_id := coalesce(first_stale_line_id, existing_line.id);
      end if;
    end loop;
    if exists (
      select 1 from public.purchase_recommendations attached
      where attached.restaurant_id = p_restaurant_id
        and attached.supplier_order_id = order_row.id
        and attached.status = 'approved'
        and attached.supplier_id is distinct from recommendation_row.supplier_id
    ) then
      stale_line_count := stale_line_count + 1;
    end if;
    if stale_line_count > 0 then
      authority := pg_catalog.jsonb_set(
        authority, '{blockers}',
        private.append_purchase_authority_blocker(
          authority->'blockers', 'draft_authority_stale',
          'An approved line in this supplier draft no longer has current supplier purchase authority.',
          pg_catalog.jsonb_build_object(
            'supplierOrderId', order_row.id,
            'supplierId', recommendation_row.supplier_id,
            'staleLineCount', stale_line_count,
            'firstStaleRecommendationId', first_stale_line_id
          )
        ), true
      );
      authority := pg_catalog.jsonb_set(authority, '{ready}', 'false'::jsonb, true);
    end if;
  end if;

  if not coalesce((authority->>'ready')::boolean, false) then
    select coalesce(pg_catalog.jsonb_agg(blocker->>'code' order by blocker->>'code'), '[]'::jsonb)
    into blocker_codes from pg_catalog.jsonb_array_elements(authority->'blockers') blocker;
    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id, auth.uid(), 'purchase_approval_blocked',
      'purchase_recommendations', recommendation_row.id,
      pg_catalog.jsonb_build_object(
        'blocker_codes', blocker_codes,
        'planning_revision', authority->'planningRevision',
        'supplier_id', recommendation_row.supplier_id
      )
    );
    return pg_catalog.jsonb_build_object(
      'outcome', 'blocked',
      'previous_status', previous_status,
      'recommendation', pg_catalog.to_jsonb(recommendation_row),
      'order', null,
      'authority', authority
    );
  end if;

  approved_quantity := coalesce(p_recommended_quantity, recommendation_row.recommended_quantity);
  suggested_quantity := recommendation_row.recommended_quantity;
  was_quantity_overridden := p_recommended_quantity is not null
    and p_recommended_quantity is distinct from recommendation_row.recommended_quantity;

  if order_row.id is null then
    insert into public.supplier_orders (
      restaurant_id, supplier_id, supplier_name, order_message, operator_note,
      status, delivery_date, purchase_authority, purchase_authority_evaluated_at
    ) values (
      p_restaurant_id, recommendation_row.supplier_id, recommendation_row.supplier_name,
      'Order draft for ' || recommendation_row.supplier_name
        || E'\n\nDelivery requested: Tomorrow morning',
      null, 'draft', current_date + 1, '{}'::jsonb, evaluated_at
    ) returning * into order_row;
  end if;

  update public.purchase_recommendations attached
  set approval_authority = draft_authority_refresh->attached.id::text,
    approval_evaluated_at = evaluated_at
  where attached.restaurant_id = p_restaurant_id
    and attached.supplier_order_id = order_row.id
    and attached.status = 'approved'
    and attached.supplier_id = recommendation_row.supplier_id
    and draft_authority_refresh ? attached.id::text;

  update public.purchase_recommendations recommendation
  set status = 'approved',
    recommended_quantity = approved_quantity,
    supplier_order_id = order_row.id,
    approval_authority = authority,
    approval_evaluated_at = evaluated_at,
    quantity_overridden = was_quantity_overridden
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id
  returning * into recommendation_row;

  update public.supplier_orders orders
  set order_message = private.build_supplier_order_message(
      p_restaurant_id, order_row.id, order_row.supplier_name, order_row.operator_note
    ),
    purchase_authority = draft_authority_refresh
      || pg_catalog.jsonb_build_object(recommendation_row.id::text, authority),
    purchase_authority_evaluated_at = evaluated_at
  where orders.restaurant_id = p_restaurant_id and orders.id = order_row.id
  returning * into order_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'recommendation_approved',
    'purchase_recommendations', recommendation_row.id,
    pg_catalog.jsonb_build_object(
      'supplier_id', recommendation_row.supplier_id,
      'supplier_name', recommendation_row.supplier_name,
      'urgency', recommendation_row.urgency,
      'supplier_order_id', order_row.id,
      'system_suggested_quantity', suggested_quantity,
      'approved_quantity', approved_quantity,
      'quantity_overridden', was_quantity_overridden,
      'authority_evaluated_at', evaluated_at,
      'revalidated_existing_line_count', revalidated_line_count
    )
  );
  return pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'previous_status', previous_status,
    'recommendation', pg_catalog.to_jsonb(recommendation_row),
    'order', pg_catalog.to_jsonb(order_row),
    'authority', authority
  );
end;
$$;

revoke all on function public.approve_purchase_recommendation_mise_003a_base(
  uuid, uuid, numeric
) from public, anon, authenticated, service_role;

create or replace function public.approve_purchase_recommendation(
  p_restaurant_id uuid,
  p_recommendation_id uuid,
  p_recommended_quantity numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommendation_snapshot public.purchase_recommendations%rowtype;
  recommendation_row public.purchase_recommendations%rowtype;
  order_row public.supplier_orders%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  delivery_blocker text;
  base_result jsonb;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  select * into recommendation_snapshot
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id;
  if not found then raise exception 'Recommendation not found' using errcode = 'P0002'; end if;

  perform private.lock_supplier_authority(
    p_restaurant_id, recommendation_snapshot.supplier_id
  );
  select * into recommendation_row
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id;
  if recommendation_row.supplier_id is distinct from recommendation_snapshot.supplier_id then
    raise exception 'Recommendation supplier identity changed concurrently; retry'
      using errcode = '40001';
  end if;

  if recommendation_row.supplier_order_id is not null then
    select * into order_row from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.id = recommendation_row.supplier_order_id
      and orders.supplier_id = recommendation_row.supplier_id;
  end if;
  if order_row.id is null then
    select * into order_row from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.supplier_id = recommendation_row.supplier_id
      and orders.status = 'draft'
    order by orders.created_at desc, orders.id desc limit 1;
  end if;

  if order_row.id is not null then
    perform 1 from public.mise_actions action
    where action.restaurant_id = p_restaurant_id
      and action.idempotency_key = pg_catalog.format(
        'send_supplier_order:%s', order_row.id
      ) for update;
    select * into order_row from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.id = order_row.id
      and orders.supplier_id = recommendation_row.supplier_id
    for update;
    select * into delivery from private.supplier_email_deliveries candidate
    where candidate.restaurant_id = p_restaurant_id
      and candidate.supplier_order_id = order_row.id
    for update;
    if recommendation_row.status <> 'approved'
      and delivery.status in ('sending', 'unknown')
    then
      delivery_blocker := case when delivery.status = 'sending'
        then 'send_in_progress' else 'delivery_requires_review' end;
      return pg_catalog.jsonb_build_object(
        'outcome', 'blocked', 'previous_status', recommendation_row.status,
        'recommendation', pg_catalog.to_jsonb(recommendation_row), 'order', null,
        'authority', pg_catalog.jsonb_build_object(
          'ready', false, 'evaluatedAt', pg_catalog.clock_timestamp(),
          'planningRevision', null,
          'blockers', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
            'code', delivery_blocker,
            'description', case when delivery.status = 'sending'
              then 'This supplier draft is already being sent.'
              else 'This supplier draft has an uncertain delivery outcome and requires review.' end,
            'metadata', pg_catalog.jsonb_build_object(
              'supplierOrderId', order_row.id,
              'supplierId', recommendation_row.supplier_id,
              'deliveryStatus', delivery.status
            )
          )),
          'evidence', pg_catalog.jsonb_build_object(
            'recommendationId', recommendation_row.id,
            'inventoryItemId', recommendation_row.inventory_item_id,
            'supplierId', recommendation_row.supplier_id,
            'basis', 'physical_count_reorder_policy',
            'demandBasis', 'manual_physical_stock',
            'recipeRevisions', '{}'::jsonb
          )
        )
      );
    end if;
  end if;

  begin
    base_result := public.approve_purchase_recommendation_mise_003a_base(
      p_restaurant_id, p_recommendation_id, p_recommended_quantity
    );
  exception when sqlstate '55000' then
    if sqlerrm not in ('send_in_progress', 'delivery_requires_review') then raise; end if;
    delivery_blocker := sqlerrm;
    select * into recommendation_row from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.id = p_recommendation_id;
    return pg_catalog.jsonb_build_object(
      'outcome', 'blocked', 'previous_status', recommendation_row.status,
      'recommendation', pg_catalog.to_jsonb(recommendation_row), 'order', null,
      'authority', pg_catalog.jsonb_build_object(
        'ready', false, 'evaluatedAt', pg_catalog.clock_timestamp(),
        'planningRevision', null,
        'blockers', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'code', delivery_blocker,
          'description', 'The unresolved supplier send prevents this draft change.',
          'metadata', pg_catalog.jsonb_build_object(
            'supplierId', recommendation_row.supplier_id
          )
        )),
        'evidence', pg_catalog.jsonb_build_object(
          'recommendationId', recommendation_row.id,
          'inventoryItemId', recommendation_row.inventory_item_id,
          'supplierId', recommendation_row.supplier_id,
          'basis', 'physical_count_reorder_policy',
          'demandBasis', 'manual_physical_stock',
          'recipeRevisions', '{}'::jsonb
        )
      )
    );
  end;
  return base_result;
end;
$$;

revoke all on function public.approve_purchase_recommendation(uuid, uuid, numeric)
from public, anon, authenticated, service_role;
grant execute on function public.approve_purchase_recommendation(uuid, uuid, numeric)
to authenticated;

create or replace function public.update_supplier_order_draft(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_operator_note text,
  p_set_operator_note boolean,
  p_delivery_date date,
  p_set_delivery_date boolean
)
returns public.supplier_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_snapshot public.supplier_orders%rowtype;
  order_row public.supplier_orders%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  select * into order_snapshot from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Order draft not found' using errcode = 'P0002'; end if;

  perform private.lock_supplier_authority(p_restaurant_id, order_snapshot.supplier_id);
  perform 1 from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.idempotency_key = pg_catalog.format('send_supplier_order:%s', p_order_id)
  for update;
  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  for update;
  if not found then raise exception 'Order draft not found' using errcode = 'P0002'; end if;
  if order_row.supplier_id is distinct from order_snapshot.supplier_id then
    raise exception 'Supplier order identity changed concurrently; retry' using errcode = '40001';
  end if;
  if order_row.status <> 'draft' then
    raise exception 'Sent orders cannot be edited' using errcode = '22023';
  end if;
  select * into delivery from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id
  for update;
  if delivery.status = 'sending' then
    raise exception 'send_in_progress' using errcode = '55000';
  end if;
  if delivery.status = 'unknown' then
    raise exception 'delivery_requires_review' using errcode = '55000';
  end if;

  update public.supplier_orders orders
  set operator_note = case when p_set_operator_note
        then nullif(pg_catalog.btrim(p_operator_note), '') else orders.operator_note end,
    delivery_date = case when p_set_delivery_date
        then p_delivery_date else orders.delivery_date end
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  returning * into order_row;
  update public.supplier_orders orders
  set order_message = private.build_supplier_order_message(
    p_restaurant_id, order_row.id, order_row.supplier_name, order_row.operator_note
  )
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  returning * into order_row;
  return order_row;
end;
$$;

revoke all on function public.update_supplier_order_draft(
  uuid, uuid, text, boolean, date, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.update_supplier_order_draft(
  uuid, uuid, text, boolean, date, boolean
) to authenticated;

create or replace function public.undo_purchase_recommendation_action(
  p_restaurant_id uuid,
  p_recommendation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommendation_snapshot public.purchase_recommendations%rowtype;
  recommendation_row public.purchase_recommendations%rowtype;
  order_row public.supplier_orders%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  previous_status text;
  remaining_count integer := 0;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  select * into recommendation_snapshot
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id;
  if not found then raise exception 'Recommendation not found' using errcode = 'P0002'; end if;

  perform private.lock_supplier_authority(
    p_restaurant_id, recommendation_snapshot.supplier_id
  );
  -- Resolve linkage only after owning the durable supplier boundary. This
  -- closes the approval-versus-undo stale-order snapshot race.
  select * into recommendation_row
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id
  for update;
  if recommendation_row.supplier_id is distinct from recommendation_snapshot.supplier_id then
    raise exception 'Recommendation supplier identity changed concurrently; retry'
      using errcode = '40001';
  end if;

  if recommendation_row.supplier_order_id is not null then
    perform 1 from public.mise_actions action
    where action.restaurant_id = p_restaurant_id
      and action.idempotency_key = pg_catalog.format(
        'send_supplier_order:%s', recommendation_row.supplier_order_id
      ) for update;
    select * into order_row from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.id = recommendation_row.supplier_order_id
      and orders.supplier_id = recommendation_row.supplier_id
    for update;
    select * into delivery from private.supplier_email_deliveries candidate
    where candidate.restaurant_id = p_restaurant_id
      and candidate.supplier_order_id = recommendation_row.supplier_order_id
    for update;
  end if;

  previous_status := recommendation_row.status;
  if previous_status = 'ordered' then
    raise exception 'This recommendation is already in supplier history and cannot be undone'
      using errcode = '22023';
  end if;
  if previous_status = 'pending' then
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_applied', 'previous_status', previous_status,
      'recommendation', pg_catalog.to_jsonb(recommendation_row), 'order', null
    );
  end if;
  if delivery.status = 'sending' then
    raise exception 'send_in_progress' using errcode = '55000';
  end if;
  if delivery.status = 'unknown' then
    raise exception 'delivery_requires_review' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.purchase_recommendations pending
    where pending.restaurant_id = p_restaurant_id
      and pending.inventory_item_id = recommendation_row.inventory_item_id
      and pending.status = 'pending'
      and pending.id <> recommendation_row.id
  ) then
    raise exception 'A newer recommendation is already pending' using errcode = '22023';
  end if;
  if previous_status = 'approved' and (
    order_row.id is null
    or order_row.status <> 'draft'
    or order_row.supplier_id is distinct from recommendation_row.supplier_id
  ) then
    raise exception 'This recommendation is already in supplier history and cannot be undone'
      using errcode = '22023';
  end if;

  update public.purchase_recommendations recommendation
  set status = 'pending', supplier_order_id = null
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id
  returning * into recommendation_row;

  if previous_status = 'approved' and order_row.id is not null then
    select count(*) into remaining_count
    from public.purchase_recommendations remaining
    where remaining.restaurant_id = p_restaurant_id
      and remaining.supplier_order_id = order_row.id
      and remaining.status = 'approved'
      and remaining.supplier_id = order_row.supplier_id;
    if remaining_count = 0 and delivery.id is null then
      delete from public.supplier_orders orders
      where orders.restaurant_id = p_restaurant_id
        and orders.id = order_row.id
        and orders.status = 'draft';
      order_row := null;
    else
      update public.supplier_orders orders
      set order_message = private.build_supplier_order_message(
        p_restaurant_id, orders.id, orders.supplier_name, orders.operator_note
      )
      where orders.restaurant_id = p_restaurant_id
        and orders.id = order_row.id
      returning * into order_row;
    end if;
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'recommendation_undo',
    'purchase_recommendations', recommendation_row.id,
    pg_catalog.jsonb_build_object(
      'previous_status', previous_status,
      'supplier_id', recommendation_row.supplier_id,
      'supplier_name', recommendation_row.supplier_name
    )
  );
  return pg_catalog.jsonb_build_object(
    'outcome', 'applied', 'previous_status', previous_status,
    'recommendation', pg_catalog.to_jsonb(recommendation_row),
    'order', case when order_row.id is null then null else pg_catalog.to_jsonb(order_row) end
  );
end;
$$;

revoke all on function public.undo_purchase_recommendation_action(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.undo_purchase_recommendation_action(uuid, uuid)
to authenticated;

create or replace function private.build_supplier_send_content(
  p_restaurant_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  content_version constant text := 'mise.supplier_send.v2';
  order_row public.supplier_orders%rowtype;
  connection public.restaurant_email_connections%rowtype;
  recipient public.supplier_recipients%rowtype;
  restaurant_name text;
  canonical_from text;
  canonical_to text;
  canonical_subject text;
  canonical_lines jsonb := '[]'::jsonb;
  canonical_snapshot jsonb;
  expected_body text;
  generated_lines text;
  blocker_codes jsonb := '[]'::jsonb;
  line_count integer := 0;
  content_fingerprint text;
begin
  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;

  if order_row.status <> 'draft' then
    blocker_codes := blocker_codes || '"order_not_draft"'::jsonb;
  end if;
  if order_row.supplier_id is null or not exists (
    select 1 from public.suppliers supplier
    where supplier.restaurant_id = p_restaurant_id
      and supplier.id = order_row.supplier_id
  ) then
    blocker_codes := blocker_codes || '"send_content_invalid"'::jsonb;
  end if;

  select * into connection
  from public.restaurant_email_connections email_connection
  where email_connection.restaurant_id = p_restaurant_id
    and email_connection.provider = 'gmail';
  if not found or connection.status <> 'connected' or connection.sender_email is null then
    blocker_codes := blocker_codes || '"gmail_not_connected"'::jsonb;
  else
    canonical_from := pg_catalog.lower(pg_catalog.btrim(connection.sender_email));
    if pg_catalog.length(canonical_from) not between 3 and 254
      or canonical_from ~ '[[:cntrl:]]'
      or canonical_from !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    then
      blocker_codes := blocker_codes || '"gmail_not_connected"'::jsonb;
      canonical_from := null;
    end if;
  end if;

  select candidate.* into recipient
  from public.supplier_recipients candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_id = order_row.supplier_id;
  if not found or recipient.email is null then
    blocker_codes := blocker_codes || '"supplier_email_missing"'::jsonb;
  else
    canonical_to := pg_catalog.lower(pg_catalog.btrim(recipient.email));
    if pg_catalog.length(canonical_to) not between 3 and 254
      or canonical_to ~ '[[:cntrl:]]'
      or canonical_to !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    then
      blocker_codes := blocker_codes || '"supplier_email_invalid"'::jsonb;
      canonical_to := null;
    end if;
  end if;

  select restaurant.name into restaurant_name
  from public.restaurants restaurant where restaurant.id = p_restaurant_id;
  if not found then raise exception 'Restaurant not found' using errcode = 'P0002'; end if;

  canonical_subject := pg_catalog.btrim(pg_catalog.regexp_replace(
    restaurant_name || ' order for ' || order_row.supplier_name,
    E'[\r\n]+', ' ', 'g'
  ));
  if pg_catalog.length(canonical_subject) not between 1 and 500
    or canonical_subject ~ '[[:cntrl:]]'
  then
    blocker_codes := blocker_codes || '"send_subject_invalid"'::jsonb;
    canonical_subject := null;
  end if;

  select count(*) into line_count
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved';

  if line_count = 0 then
    blocker_codes := blocker_codes || '"order_lines_missing"'::jsonb;
  elsif line_count > 250 then
    blocker_codes := blocker_codes || '"send_content_too_large"'::jsonb;
  else
    if exists (
      select 1 from public.purchase_recommendations recommendation
      where recommendation.restaurant_id = p_restaurant_id
        and recommendation.supplier_order_id = p_order_id
        and recommendation.status = 'approved'
        and (
          recommendation.supplier_id is distinct from order_row.supplier_id
          or recommendation.supplier_name is distinct from order_row.supplier_name
        )
    ) then
      blocker_codes := blocker_codes || '"send_content_invalid"'::jsonb;
    end if;

    select coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'recommendationId', recommendation.id,
        'inventoryItemId', recommendation.inventory_item_id,
        'itemName', recommendation.item_name,
        'quantity', recommendation.recommended_quantity,
        'unit', recommendation.unit,
        'supplierId', recommendation.supplier_id,
        'supplierName', recommendation.supplier_name
      ) order by recommendation.id
    ), '[]'::jsonb)
    into canonical_lines
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved';

    select pg_catalog.string_agg(
      pg_catalog.left(recommendation.item_name, 200) || ' - '
        || recommendation.recommended_quantity::text || ' '
        || pg_catalog.left(recommendation.unit, 40),
      E'\n' order by recommendation.item_name, recommendation.id
    ) into generated_lines
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved';

    expected_body := 'Order draft for ' || pg_catalog.left(order_row.supplier_name, 160)
      || E'\n\n' || coalesce(generated_lines, '')
      || E'\n\nDelivery requested: Tomorrow morning'
      || case when nullif(pg_catalog.btrim(order_row.operator_note), '') is null then ''
        else E'\n\nNotes:\n' || pg_catalog.left(pg_catalog.btrim(order_row.operator_note), 2000) end;
    if pg_catalog.octet_length(expected_body) > 65536 then
      blocker_codes := blocker_codes || '"send_content_too_large"'::jsonb;
    elsif order_row.order_message is distinct from expected_body then
      blocker_codes := blocker_codes || '"send_content_invalid"'::jsonb;
    end if;
  end if;

  select coalesce(pg_catalog.jsonb_agg(code order by code), '[]'::jsonb)
  into blocker_codes
  from (
    select distinct value #>> '{}' as code
    from pg_catalog.jsonb_array_elements(blocker_codes)
  ) bounded;

  canonical_snapshot := pg_catalog.jsonb_build_object(
    'version', content_version,
    'contentRevision', order_row.send_content_revision,
    'restaurantId', p_restaurant_id,
    'orderId', order_row.id,
    'supplierId', order_row.supplier_id,
    'supplierName', order_row.supplier_name,
    'from', canonical_from,
    'to', canonical_to,
    'subject', canonical_subject,
    'body', order_row.order_message,
    'deliveryDate', order_row.delivery_date,
    'operatorNote', order_row.operator_note,
    'lines', canonical_lines
  );
  if pg_catalog.jsonb_array_length(blocker_codes) = 0 then
    content_fingerprint := private.supplier_send_sha256(
      content_version, canonical_snapshot
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'ready', pg_catalog.jsonb_array_length(blocker_codes) = 0,
    'blockerCodes', blocker_codes,
    'lineCount', line_count,
    'contentVersion', content_version,
    'contentFingerprint', content_fingerprint,
    'content', canonical_snapshot
  );
end;
$$;

revoke all on function private.build_supplier_send_content(uuid, uuid)
from public, anon, authenticated, service_role;

create or replace function public.approve_supplier_send_content(
  p_restaurant_id uuid,
  p_action_id uuid,
  p_order_id uuid,
  p_reviewed_content_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_row public.mise_actions%rowtype;
  order_snapshot public.supplier_orders%rowtype;
  order_row public.supplier_orders%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  built jsonb;
  content jsonb;
  approved_content jsonb;
  reviewed_fingerprint text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_reviewed_content_fingerprint, ''))
  );
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if reviewed_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'Supplier send content fingerprint is invalid' using errcode = '22023';
  end if;

  select * into order_snapshot from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;
  perform private.lock_supplier_authority(p_restaurant_id, order_snapshot.supplier_id);

  select * into action_row from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.id = p_action_id
    and action.action_type = 'send_supplier_order'
    and (
      action.idempotency_key = pg_catalog.format('send_supplier_order:%s', p_order_id)
      or action.expected_impact->>'orderId' = p_order_id::text
    )
  for update;
  if not found then
    raise exception 'Supplier send approval required: prepared action not found'
      using errcode = '22023';
  end if;
  if action_row.expected_impact ? 'supplierId'
    and action_row.expected_impact->>'supplierId' <> order_snapshot.supplier_id::text
  then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_content_changed',
      'blockerCodes', pg_catalog.jsonb_build_array('send_content_changed')
    );
  end if;
  if action_row.status not in ('prepared', 'waiting_for_approval', 'approved', 'failed') then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_content_unapproved',
      'blockerCodes', pg_catalog.jsonb_build_array('send_content_unapproved')
    );
  end if;

  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  for update;
  if order_row.supplier_id is distinct from order_snapshot.supplier_id then
    raise exception 'Supplier order identity changed concurrently; retry' using errcode = '40001';
  end if;
  select * into delivery from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id
  for update;
  if found and delivery.status = 'sending' then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_in_progress',
      'blockerCodes', pg_catalog.jsonb_build_array('send_in_progress')
    );
  elsif found and delivery.status = 'unknown' then
    return pg_catalog.jsonb_build_object(
      'outcome', 'delivery_requires_review',
      'blockerCodes', pg_catalog.jsonb_build_array('delivery_requires_review')
    );
  end if;

  perform 1 from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved'
  order by recommendation.id for update;
  perform 1 from public.restaurant_email_connections connection
  where connection.restaurant_id = p_restaurant_id and connection.provider = 'gmail'
  for update;
  perform 1 from public.supplier_recipients recipient
  where recipient.restaurant_id = p_restaurant_id
    and recipient.supplier_id = order_row.supplier_id
  for update;
  perform 1 from public.restaurants restaurant
  where restaurant.id = p_restaurant_id for share;

  built := private.build_supplier_send_content(p_restaurant_id, p_order_id);
  if not coalesce((built->>'ready')::boolean, false) then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_content_unapproved',
      'blockerCodes', built->'blockerCodes'
    );
  end if;
  if built->>'contentFingerprint' is distinct from reviewed_fingerprint then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_content_changed',
      'blockerCodes', pg_catalog.jsonb_build_array('send_content_changed')
    );
  end if;

  approved_content := action_row.expected_impact->'approvedSendContent';
  if action_row.status = 'approved'
    and approved_content->>'version' = built->>'contentVersion'
    and approved_content->>'fingerprint' = reviewed_fingerprint
    and approved_content->>'supplierId' = order_row.supplier_id::text
    and approved_content->'contentRevision' = built->'content'->'contentRevision'
  then
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_applied', 'action', pg_catalog.to_jsonb(action_row),
      'contentVersion', built->>'contentVersion',
      'contentFingerprint', reviewed_fingerprint
    );
  end if;

  if action_row.status <> 'approved' then
    action_row := public.decide_mise_action(p_restaurant_id, p_action_id, 'approved');
  end if;
  content := built->'content';
  update public.mise_actions action
  set approved_by = auth.uid(),
    expected_impact = (
      coalesce(action.expected_impact, '{}'::jsonb)
        - 'approvedEnvelope' - 'approvedSendContent'
    ) || pg_catalog.jsonb_build_object(
      'supplierId', order_row.supplier_id,
      'approvedSendContent', pg_catalog.jsonb_build_object(
        'version', built->>'contentVersion',
        'fingerprint', reviewed_fingerprint,
        'supplierId', order_row.supplier_id,
        'approvedAt', pg_catalog.clock_timestamp(),
        'lineCount', built->'lineCount',
        'contentRevision', (content->>'contentRevision')::bigint,
        'from', content->>'from', 'to', content->>'to',
        'subject', content->>'subject'
      )
    ),
    error_code = null, error_message = null, updated_at = pg_catalog.now()
  where action.restaurant_id = p_restaurant_id and action.id = p_action_id
  returning * into action_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'supplier_send_content_approved',
    'mise_actions', p_action_id,
    pg_catalog.jsonb_build_object(
      'supplier_order_id', p_order_id,
      'supplier_id', order_row.supplier_id,
      'content_version', built->>'contentVersion',
      'content_fingerprint', reviewed_fingerprint,
      'line_count', built->'lineCount'
    )
  );
  return pg_catalog.jsonb_build_object(
    'outcome', 'applied', 'action', pg_catalog.to_jsonb(action_row),
    'contentVersion', built->>'contentVersion',
    'contentFingerprint', reviewed_fingerprint
  );
end;
$$;

revoke all on function public.approve_supplier_send_content(uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.approve_supplier_send_content(uuid, uuid, uuid, text)
to authenticated;

alter table private.supplier_email_deliveries
  drop constraint supplier_email_deliveries_mise_003b_metadata_check;
alter table private.supplier_email_deliveries
  add constraint supplier_email_deliveries_mise_003c_metadata_check check (
    (
      content_version is null
      and content_fingerprint is null
      and authority_version is null
      and authority_fingerprint is null
      and approved_action_id is null
      and claimed_recommendation_ids is null
      and claimed_from is null
      and claimed_to is null
      and claimed_subject is null
      and credential_generation is null
      and claimed_content_revision is null
      and authority_evaluated_at is null
      and supplier_id is null
    )
    or (
      content_version in ('mise.supplier_send.v1', 'mise.supplier_send.v2')
      and (
        (content_version = 'mise.supplier_send.v1' and supplier_id is null)
        or (content_version = 'mise.supplier_send.v2' and supplier_id is not null)
      )
      and content_fingerprint ~ '^[a-f0-9]{64}$'
      and authority_version = 'mise.purchase_authority.v1'
      and authority_fingerprint ~ '^[a-f0-9]{64}$'
      and approved_action_id is not null
      and claimed_recommendation_ids is not null
      and pg_catalog.cardinality(claimed_recommendation_ids) between 1 and 250
      and claimed_from is not null
      and pg_catalog.length(claimed_from) between 3 and 254
      and claimed_from = pg_catalog.lower(pg_catalog.btrim(claimed_from))
      and claimed_from !~ '[[:cntrl:]]'
      and claimed_to is not null
      and pg_catalog.length(claimed_to) between 3 and 254
      and claimed_to = pg_catalog.lower(pg_catalog.btrim(claimed_to))
      and claimed_to !~ '[[:cntrl:]]'
      and claimed_subject is not null
      and pg_catalog.length(claimed_subject) between 1 and 500
      and claimed_subject = pg_catalog.btrim(claimed_subject)
      and claimed_subject !~ '[[:cntrl:]]'
      and credential_generation > 0
      and claimed_content_revision > 0
      and authority_evaluated_at is not null
    )
  );

create or replace function private.evaluate_supplier_send_purchase_authority(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_evaluated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authority_version constant text := 'mise.purchase_authority.v1';
  order_row public.supplier_orders%rowtype;
  recommendation_row public.purchase_recommendations%rowtype;
  current_authority jsonb;
  stored_authority jsonb;
  authority_lines jsonb := '[]'::jsonb;
  blocker_codes jsonb := '[]'::jsonb;
  normalized_blocker_codes jsonb;
  line_count integer := 0;
  authority_fingerprint text;
begin
  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;

  for recommendation_row in
    select recommendation.* from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved'
    order by recommendation.id
  loop
    line_count := line_count + 1;
    if recommendation_row.supplier_id is distinct from order_row.supplier_id then
      blocker_codes := blocker_codes || '"supplier_mismatch"'::jsonb;
    end if;
    stored_authority := order_row.purchase_authority->recommendation_row.id::text;
    if stored_authority is null
      or recommendation_row.approval_authority is null
      or not coalesce((recommendation_row.approval_authority->>'ready')::boolean, false)
      or stored_authority is distinct from recommendation_row.approval_authority
    then
      blocker_codes := blocker_codes || '"draft_authority_incomplete"'::jsonb;
    end if;
    current_authority := private.evaluate_purchase_recommendation_authority(
      p_restaurant_id, recommendation_row.id, p_evaluated_at
    );
    authority_lines := authority_lines || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'recommendationId', recommendation_row.id,
        'supplierId', recommendation_row.supplier_id,
        'authority', current_authority
      )
    );
    if not coalesce((current_authority->>'ready')::boolean, false) then
      blocker_codes := blocker_codes || '"purchase_authority_stale"'::jsonb;
      blocker_codes := blocker_codes || coalesce((
        select pg_catalog.jsonb_agg(blocker->>'code')
        from pg_catalog.jsonb_array_elements(current_authority->'blockers') blocker
        where blocker->>'code' is not null
      ), '[]'::jsonb);
    end if;
  end loop;

  if line_count = 0 then
    blocker_codes := blocker_codes || '"draft_authority_incomplete"'::jsonb;
  end if;
  if (
    select count(*) from pg_catalog.jsonb_object_keys(
      coalesce(order_row.purchase_authority, '{}'::jsonb)
    )
  ) <> line_count then
    blocker_codes := blocker_codes || '"draft_authority_incomplete"'::jsonb;
  end if;
  select coalesce(pg_catalog.jsonb_agg(code order by code), '[]'::jsonb)
  into normalized_blocker_codes
  from (
    select distinct value #>> '{}' as code
    from pg_catalog.jsonb_array_elements(blocker_codes)
  ) bounded;

  authority_fingerprint := private.supplier_send_sha256(
    authority_version,
    pg_catalog.jsonb_build_object(
      'version', authority_version,
      'evaluatedAt', p_evaluated_at,
      'supplierId', order_row.supplier_id,
      'lines', authority_lines
    )
  );
  return pg_catalog.jsonb_build_object(
    'ready', pg_catalog.jsonb_array_length(normalized_blocker_codes) = 0,
    'blockerCodes', normalized_blocker_codes,
    'lineCount', line_count,
    'supplierId', order_row.supplier_id,
    'authorityVersion', authority_version,
    'authorityFingerprint', authority_fingerprint
  );
end;
$$;

revoke all on function private.evaluate_supplier_send_purchase_authority(
  uuid, uuid, timestamptz
) from public, anon, authenticated, service_role;

create or replace function private.service_claim_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_idempotency_key uuid,
  p_rfc_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_snapshot public.supplier_orders%rowtype;
  order_row public.supplier_orders%rowtype;
  action_row public.mise_actions%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  credential private.gmail_credentials%rowtype;
  connection public.restaurant_email_connections%rowtype;
  recipient public.supplier_recipients%rowtype;
  system_controls public.system_operational_controls%rowtype;
  restaurant_controls public.restaurant_operational_controls%rowtype;
  approved_content jsonb;
  built jsonb;
  content jsonb;
  authority_result jsonb;
  evaluated_at timestamptz;
  decrypted_credential text;
  next_claim_token uuid := gen_random_uuid();
  claimed_ids uuid[];
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier email access denied' using errcode = '42501';
  end if;
  if p_idempotency_key is null or p_idempotency_key <> p_order_id
    or p_rfc_message_id is null
    or pg_catalog.length(p_rfc_message_id) not between 6 and 512
    or p_rfc_message_id ~ '[[:cntrl:]]'
  then
    raise exception 'Invalid supplier email idempotency material' using errcode = '22023';
  end if;

  select * into order_snapshot from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;
  perform private.lock_supplier_authority(p_restaurant_id, order_snapshot.supplier_id);
  select * into action_row from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.action_type = 'send_supplier_order'
    and action.idempotency_key = pg_catalog.format('send_supplier_order:%s', p_order_id)
  for update;
  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  for update;
  if order_row.supplier_id is distinct from order_snapshot.supplier_id then
    raise exception 'Supplier order identity changed concurrently; retry' using errcode = '40001';
  end if;
  select * into delivery from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id
  for update;

  if delivery.id is not null and delivery.status = 'sent' then
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_sent',
      'providerMessageId', delivery.provider_message_id,
      'externalIdentityChangedDuringClaim', delivery.external_identity_changed_during_claim,
      'orderStatus', order_row.status,
      'supplierId', coalesce(delivery.supplier_id, order_row.supplier_id)
    );
  end if;
  if delivery.id is not null and delivery.status = 'unknown' then
    if action_row.id is not null and action_row.status <> 'executed' then
      update public.mise_actions action
      set status = 'unverified',
        error_code = coalesce(delivery.last_error_code, 'supplier_email_outcome_unknown'),
        error_message = 'The Gmail delivery result is uncertain and requires review.',
        updated_at = pg_catalog.now()
      where action.restaurant_id = p_restaurant_id and action.id = action_row.id;
    end if;
    return pg_catalog.jsonb_build_object('outcome', 'requires_review');
  end if;
  if delivery.id is not null and delivery.status = 'sending' then
    if delivery.content_version is null
      or delivery.claimed_recommendation_ids is null
      or delivery.claimed_at < pg_catalog.now() - interval '10 minutes'
    then
      update private.supplier_email_deliveries candidate
      set status = 'unknown',
        last_error_code = case when delivery.content_version is null
          then 'legacy_unproven_claim' else 'stale_send_claim' end,
        updated_at = pg_catalog.now()
      where candidate.id = delivery.id;
      if action_row.id is not null and action_row.status <> 'executed' then
        update public.mise_actions action
        set status = 'unverified',
          error_code = case when delivery.content_version is null
            then 'legacy_unproven_claim' else 'stale_send_claim' end,
          error_message = 'The Gmail delivery result is uncertain and requires review.',
          updated_at = pg_catalog.now()
        where action.restaurant_id = p_restaurant_id and action.id = action_row.id;
      end if;
      return pg_catalog.jsonb_build_object('outcome', 'requires_review');
    end if;
    return pg_catalog.jsonb_build_object('outcome', 'in_progress');
  end if;
  if delivery.id is not null and delivery.idempotency_key <> p_idempotency_key then
    raise exception 'Supplier email idempotency conflict' using errcode = '22023';
  end if;
  if delivery.id is not null and delivery.rfc_message_id <> p_rfc_message_id then
    raise exception 'Supplier email Message-Id changed' using errcode = '22023';
  end if;
  if order_row.status <> 'draft' then
    raise exception 'Only draft supplier orders can be emailed' using errcode = '22023';
  end if;

  select * into system_controls from public.system_operational_controls controls
  where controls.singleton for share;
  select * into restaurant_controls from public.restaurant_operational_controls controls
  where controls.restaurant_id = p_restaurant_id for share;
  if system_controls.singleton is null
    or system_controls.operational_mode <> 'normal'
    or not system_controls.gmail_delivery_enabled
    or restaurant_controls.restaurant_id is null
    or not restaurant_controls.gmail_delivery_enabled
  then return pg_catalog.jsonb_build_object('outcome', 'provider_not_enabled'); end if;

  select * into credential from private.gmail_credentials candidate
  where candidate.restaurant_id = p_restaurant_id for update;
  select * into connection from public.restaurant_email_connections email_connection
  where email_connection.restaurant_id = p_restaurant_id
    and email_connection.provider = 'gmail'
  for update;
  if credential.id is null or connection.id is null
    or connection.status <> 'connected' or connection.sender_email is null
    or credential.sender_email <> pg_catalog.lower(pg_catalog.btrim(connection.sender_email))
  then return pg_catalog.jsonb_build_object('outcome', 'gmail_not_connected'); end if;

  perform 1 from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved'
  order by recommendation.id for update;
  select pg_catalog.array_agg(recommendation.id order by recommendation.id)
  into claimed_ids from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved';
  if coalesce(pg_catalog.cardinality(claimed_ids), 0) = 0 then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_content_unapproved',
      'blockerCodes', pg_catalog.jsonb_build_array('order_lines_missing')
    );
  elsif pg_catalog.cardinality(claimed_ids) > 250 then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_content_unapproved',
      'blockerCodes', pg_catalog.jsonb_build_array('send_content_too_large')
    );
  elsif exists (
    select 1 from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved'
      and recommendation.supplier_id is distinct from order_row.supplier_id
  ) then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_content_unapproved',
      'blockerCodes', pg_catalog.jsonb_build_array('send_content_invalid')
    );
  end if;

  perform 1 from public.inventory_items item
  where item.restaurant_id = p_restaurant_id and exists (
    select 1 from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved'
      and recommendation.inventory_item_id = item.id
  ) order by item.id for update;
  perform 1 from public.pos_integrations integration
    where integration.restaurant_id = p_restaurant_id order by integration.id for share;
  perform 1 from public.pos_locations location
    where location.restaurant_id = p_restaurant_id order by location.id for share;
  perform 1 from public.pos_catalog_item_mappings mapping
    where mapping.restaurant_id = p_restaurant_id order by mapping.id for share;
  perform 1 from public.menu_items menu_item
    where menu_item.restaurant_id = p_restaurant_id order by menu_item.id for share;
  perform 1 from public.menu_item_ingredients ingredient
    where ingredient.restaurant_id = p_restaurant_id order by ingredient.id for share;
  select * into recipient from public.supplier_recipients candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_id = order_row.supplier_id
  for update;
  perform 1 from public.restaurants restaurant
    where restaurant.id = p_restaurant_id for share;
  perform 1 from private.restaurant_signal_state state
    where state.restaurant_id = p_restaurant_id for update;
  evaluated_at := pg_catalog.clock_timestamp();
  if recipient.id is null or recipient.email is null then
    return pg_catalog.jsonb_build_object('outcome', 'supplier_email_missing');
  end if;

  if action_row.id is null then
    return pg_catalog.jsonb_build_object('outcome', 'send_content_unapproved');
  end if;
  approved_content := action_row.expected_impact->'approvedSendContent';
  if action_row.status <> 'approved'
    or approved_content is null
    or pg_catalog.jsonb_typeof(approved_content) <> 'object'
    or approved_content->>'version' <> 'mise.supplier_send.v2'
    or approved_content->>'supplierId' <> order_row.supplier_id::text
    or action_row.expected_impact->>'supplierId' <> order_row.supplier_id::text
    or coalesce(approved_content->>'fingerprint', '') !~ '^[a-f0-9]{64}$'
    or pg_catalog.jsonb_typeof(approved_content->'contentRevision') is distinct from 'number'
  then return pg_catalog.jsonb_build_object('outcome', 'send_content_unapproved'); end if;

  authority_result := private.evaluate_supplier_send_purchase_authority(
    p_restaurant_id, p_order_id, evaluated_at
  );
  if not coalesce((authority_result->>'ready')::boolean, false) then
    return pg_catalog.jsonb_build_object(
      'outcome', case when authority_result->'blockerCodes' ? 'draft_authority_incomplete'
        then 'draft_authority_incomplete' else 'purchase_authority_stale' end,
      'blockerCodes', authority_result->'blockerCodes'
    );
  end if;

  built := private.build_supplier_send_content(p_restaurant_id, p_order_id);
  if not coalesce((built->>'ready')::boolean, false) then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_content_unapproved', 'blockerCodes', built->'blockerCodes'
    );
  end if;
  content := built->'content';
  if built->>'contentVersion' is distinct from approved_content->>'version'
    or built->>'contentFingerprint' is distinct from approved_content->>'fingerprint'
    or content->>'supplierId' is distinct from order_row.supplier_id::text
    or content->'contentRevision' is distinct from approved_content->'contentRevision'
  then return pg_catalog.jsonb_build_object('outcome', 'send_content_changed'); end if;

  select secret.decrypted_secret into decrypted_credential
  from vault.decrypted_secrets secret
  where secret.id = credential.refresh_token_secret_id;
  if decrypted_credential is null then
    update public.restaurant_email_connections email_connection
    set status = 'needs_reauth', last_verified_at = null, updated_at = pg_catalog.now()
    where email_connection.id = connection.id;
    return pg_catalog.jsonb_build_object('outcome', 'gmail_not_connected');
  end if;

  if delivery.id is null then
    insert into private.supplier_email_deliveries (
      restaurant_id, supplier_order_id, supplier_id, actor_user_id,
      idempotency_key, claim_token, status, rfc_message_id, content_version,
      content_fingerprint, authority_version, authority_fingerprint,
      approved_action_id, claimed_recommendation_ids, claimed_from,
      claimed_to, claimed_subject, credential_generation,
      claimed_content_revision, authority_evaluated_at
    ) values (
      p_restaurant_id, p_order_id, order_row.supplier_id, p_actor_user_id,
      p_idempotency_key, next_claim_token, 'sending', p_rfc_message_id,
      built->>'contentVersion', built->>'contentFingerprint',
      authority_result->>'authorityVersion', authority_result->>'authorityFingerprint',
      action_row.id, claimed_ids, content->>'from', content->>'to', content->>'subject',
      credential.credential_generation, (content->>'contentRevision')::bigint,
      evaluated_at
    ) returning * into delivery;
  else
    update private.supplier_email_deliveries candidate
    set supplier_id = order_row.supplier_id,
      actor_user_id = p_actor_user_id, claim_token = next_claim_token,
      status = 'sending', attempt_count = candidate.attempt_count + 1,
      last_error_code = null, claimed_at = pg_catalog.now(), updated_at = pg_catalog.now(),
      content_version = built->>'contentVersion',
      content_fingerprint = built->>'contentFingerprint',
      authority_version = authority_result->>'authorityVersion',
      authority_fingerprint = authority_result->>'authorityFingerprint',
      approved_action_id = action_row.id, claimed_recommendation_ids = claimed_ids,
      claimed_from = content->>'from', claimed_to = content->>'to',
      claimed_subject = content->>'subject',
      credential_generation = credential.credential_generation,
      claimed_content_revision = (content->>'contentRevision')::bigint,
      authority_evaluated_at = evaluated_at,
      external_identity_changed_during_claim = false
    where candidate.id = delivery.id and candidate.status = 'failed'
    returning * into delivery;
    if not found then
      raise exception 'Supplier email claim is unavailable' using errcode = '22023';
    end if;
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, 'supplier_email_claimed',
    'supplier_orders', p_order_id,
    pg_catalog.jsonb_build_object(
      'supplier_id', delivery.supplier_id,
      'content_version', delivery.content_version,
      'content_fingerprint', delivery.content_fingerprint,
      'authority_version', delivery.authority_version,
      'authority_fingerprint', delivery.authority_fingerprint,
      'line_count', pg_catalog.cardinality(delivery.claimed_recommendation_ids)
    )
  );
  return pg_catalog.jsonb_build_object(
    'outcome', 'claimed', 'claimToken', delivery.claim_token,
    'supplierId', delivery.supplier_id,
    'credentialId', credential.id,
    'credentialGeneration', credential.credential_generation,
    'refreshToken', decrypted_credential,
    'contentVersion', delivery.content_version,
    'contentFingerprint', delivery.content_fingerprint,
    'authorityVersion', delivery.authority_version,
    'authorityFingerprint', delivery.authority_fingerprint,
    'from', delivery.claimed_from, 'to', delivery.claimed_to,
    'subject', delivery.claimed_subject, 'body', content->>'body',
    'rfcMessageId', delivery.rfc_message_id
  );
end;
$$;

revoke all on function private.service_claim_supplier_email_send(
  uuid, uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function private.service_claim_supplier_email_send(
  uuid, uuid, uuid, uuid, text
) to service_role;

create or replace function private.service_observe_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_snapshot public.supplier_orders%rowtype;
  order_row public.supplier_orders%rowtype;
  action_row public.mise_actions%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier email access denied' using errcode = '42501';
  end if;
  select * into order_snapshot from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;
  perform private.lock_supplier_authority(p_restaurant_id, order_snapshot.supplier_id);
  select * into action_row from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.idempotency_key = pg_catalog.format('send_supplier_order:%s', p_order_id)
  for update;
  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  for update;
  if order_row.supplier_id is distinct from order_snapshot.supplier_id then
    raise exception 'Supplier order identity changed concurrently; retry' using errcode = '40001';
  end if;
  select * into delivery from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id
  for update;
  if not found or delivery.status = 'failed' then
    return pg_catalog.jsonb_build_object('outcome', 'claim_required');
  end if;
  if delivery.status = 'sent' then
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_sent', 'providerMessageId', delivery.provider_message_id,
      'supplierId', coalesce(delivery.supplier_id, order_row.supplier_id),
      'externalIdentityChangedDuringClaim', delivery.external_identity_changed_during_claim,
      'orderStatus', order_row.status
    );
  end if;
  if delivery.status = 'unknown' then
    if action_row.id is not null and action_row.status <> 'executed' then
      update public.mise_actions action
      set status = 'unverified',
        error_code = coalesce(delivery.last_error_code, 'supplier_email_outcome_unknown'),
        error_message = 'The Gmail delivery result is uncertain and requires review.',
        updated_at = pg_catalog.now()
      where action.restaurant_id = p_restaurant_id and action.id = action_row.id;
    end if;
    return pg_catalog.jsonb_build_object('outcome', 'requires_review');
  end if;
  if delivery.content_version is null or delivery.claimed_recommendation_ids is null then
    update private.supplier_email_deliveries candidate
    set status = 'unknown', last_error_code = 'legacy_unproven_claim',
      updated_at = pg_catalog.now()
    where candidate.id = delivery.id;
    if action_row.id is not null and action_row.status <> 'executed' then
      update public.mise_actions action
      set status = 'unverified', error_code = 'legacy_unproven_claim',
        error_message = 'The Gmail delivery result is uncertain and requires review.',
        updated_at = pg_catalog.now()
      where action.restaurant_id = p_restaurant_id and action.id = action_row.id;
    end if;
    return pg_catalog.jsonb_build_object('outcome', 'requires_review');
  end if;
  if delivery.claimed_at < pg_catalog.now() - interval '10 minutes' then
    update private.supplier_email_deliveries candidate
    set status = 'unknown', last_error_code = 'stale_send_claim',
      updated_at = pg_catalog.now()
    where candidate.id = delivery.id;
    if action_row.id is not null and action_row.status <> 'executed' then
      update public.mise_actions action
      set status = 'unverified', error_code = 'stale_send_claim',
        error_message = 'The Gmail delivery result is uncertain and requires review.',
        updated_at = pg_catalog.now()
      where action.restaurant_id = p_restaurant_id and action.id = action_row.id;
    end if;
    return pg_catalog.jsonb_build_object('outcome', 'requires_review');
  end if;
  return pg_catalog.jsonb_build_object('outcome', 'in_progress');
end;
$$;

revoke all on function private.service_observe_supplier_email_send(uuid, uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function private.service_observe_supplier_email_send(uuid, uuid, uuid)
to service_role;

create or replace function private.service_fail_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_claim_token uuid,
  p_outcome text,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_code text := private.gmail_safe_error_code(p_error_code);
  next_delivery_status text;
  next_action_status text;
  order_snapshot public.supplier_orders%rowtype;
  order_row public.supplier_orders%rowtype;
  action_row public.mise_actions%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  current_display_name text;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier email access denied' using errcode = '42501';
  end if;
  if p_outcome not in ('rejected', 'unknown') then
    raise exception 'Invalid supplier email failure outcome' using errcode = '22023';
  end if;
  next_delivery_status := case when p_outcome = 'rejected' then 'failed' else 'unknown' end;
  next_action_status := case when p_outcome = 'rejected' then 'failed' else 'unverified' end;

  select * into order_snapshot from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;
  perform private.lock_supplier_authority(p_restaurant_id, order_snapshot.supplier_id);
  select * into action_row from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.idempotency_key = pg_catalog.format('send_supplier_order:%s', p_order_id)
  for update;
  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  for update;
  if order_row.supplier_id is distinct from order_snapshot.supplier_id then
    raise exception 'Supplier order identity changed concurrently; retry' using errcode = '40001';
  end if;
  select * into delivery from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id
  for update;
  if not found then
    raise exception 'Supplier email claim is unavailable' using errcode = '22023';
  end if;
  if delivery.claim_token = p_claim_token
    and delivery.actor_user_id = p_actor_user_id
    and delivery.status = next_delivery_status
  then
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_applied', 'status', next_delivery_status
    );
  end if;
  if delivery.status <> 'sending'
    or delivery.claim_token <> p_claim_token
    or delivery.actor_user_id <> p_actor_user_id
  then
    raise exception 'Supplier email claim is unavailable' using errcode = '22023';
  end if;

  update private.supplier_email_deliveries candidate
  set status = next_delivery_status, last_error_code = safe_code,
    updated_at = pg_catalog.now()
  where candidate.id = delivery.id;

  if next_delivery_status = 'failed'
    and delivery.external_identity_changed_during_claim
  then
    select supplier.display_name into current_display_name
    from public.suppliers supplier
    where supplier.restaurant_id = p_restaurant_id
      and supplier.id = order_row.supplier_id;
    update public.purchase_recommendations recommendation
    set supplier_name = current_display_name
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.supplier_id = order_row.supplier_id
      and recommendation.status = 'approved';
    update public.supplier_orders orders
    set supplier_name = current_display_name,
      send_content_revision = orders.send_content_revision + 1
    where orders.restaurant_id = p_restaurant_id
      and orders.id = p_order_id and orders.status = 'draft';
    update public.supplier_orders orders
    set order_message = private.build_supplier_order_message(
      p_restaurant_id, orders.id, orders.supplier_name, orders.operator_note
    )
    where orders.restaurant_id = p_restaurant_id
      and orders.id = p_order_id and orders.status = 'draft';
  end if;

  if action_row.id is not null
    and action_row.id = delivery.approved_action_id
    and action_row.status <> 'executed'
  then
    update public.mise_actions action
    set status = next_action_status, error_code = safe_code,
      error_message = case when next_action_status = 'unverified'
        then 'The Gmail delivery result is uncertain and requires review.'
        else 'Gmail definitively rejected the supplier email.' end,
      updated_at = pg_catalog.now()
    where action.restaurant_id = p_restaurant_id and action.id = action_row.id;
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id,
    case when next_delivery_status = 'unknown'
      then 'supplier_email_outcome_unknown' else 'supplier_email_rejected' end,
    'supplier_orders', p_order_id,
    pg_catalog.jsonb_build_object(
      'provider', 'gmail', 'reason', safe_code,
      'supplier_id', coalesce(delivery.supplier_id, order_row.supplier_id),
      'content_version', delivery.content_version,
      'content_fingerprint', delivery.content_fingerprint
    )
  );
  return pg_catalog.jsonb_build_object('outcome', next_delivery_status);
end;
$$;

revoke all on function private.service_fail_supplier_email_send(
  uuid, uuid, uuid, uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function private.service_fail_supplier_email_send(
  uuid, uuid, uuid, uuid, text, text
) to service_role;

create or replace function private.service_complete_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_claim_token uuid,
  p_provider_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_snapshot public.supplier_orders%rowtype;
  order_row public.supplier_orders%rowtype;
  action_row public.mise_actions%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  current_ids uuid[];
  normalized_claimed_ids uuid[];
  ordered_rows jsonb;
  changed_count integer;
  is_v2 boolean;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier email access denied' using errcode = '42501';
  end if;
  if p_provider_message_id is null
    or pg_catalog.length(p_provider_message_id) not between 1 and 512
    or p_provider_message_id ~ '[[:cntrl:]]'
  then
    raise exception 'Invalid provider message id' using errcode = '22023';
  end if;

  select * into order_snapshot from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;
  perform private.lock_supplier_authority(p_restaurant_id, order_snapshot.supplier_id);
  select * into action_row from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.idempotency_key = pg_catalog.format('send_supplier_order:%s', p_order_id)
  for update;
  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  for update;
  if order_row.supplier_id is distinct from order_snapshot.supplier_id then
    raise exception 'Supplier order identity changed concurrently; retry' using errcode = '40001';
  end if;
  select * into delivery from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id
  for update;
  if not found then
    raise exception 'Supplier email claim is unavailable' using errcode = '22023';
  end if;

  if delivery.status = 'sent' and delivery.provider_message_id = p_provider_message_id then
    select coalesce(pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(recommendation) order by recommendation.id
    ), '[]'::jsonb)
    into ordered_rows from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.id = any(coalesce(
        delivery.claimed_recommendation_ids, '{}'::uuid[]
      ))
      and recommendation.status = 'ordered';
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_applied',
      'supplierId', coalesce(delivery.supplier_id, order_row.supplier_id),
      'externalIdentityChangedDuringClaim', delivery.external_identity_changed_during_claim,
      'order', pg_catalog.to_jsonb(order_row),
      'ordered_recommendations', ordered_rows
    );
  end if;
  if delivery.status <> 'sending'
    or delivery.claim_token <> p_claim_token
    or delivery.actor_user_id <> p_actor_user_id
  then
    raise exception 'Supplier email claim is unavailable' using errcode = '22023';
  end if;

  is_v2 := delivery.content_version = 'mise.supplier_send.v2';
  if delivery.content_version not in ('mise.supplier_send.v1', 'mise.supplier_send.v2')
    or (is_v2 and delivery.supplier_id is distinct from order_row.supplier_id)
    or (not is_v2 and delivery.supplier_id is not null)
    or delivery.content_fingerprint !~ '^[a-f0-9]{64}$'
    or delivery.authority_version <> 'mise.purchase_authority.v1'
    or delivery.authority_fingerprint !~ '^[a-f0-9]{64}$'
    or delivery.approved_action_id is null
    or delivery.claimed_recommendation_ids is null
    or pg_catalog.cardinality(delivery.claimed_recommendation_ids) not between 1 and 250
    or delivery.claimed_from is null or delivery.claimed_to is null
    or delivery.claimed_subject is null or delivery.credential_generation is null
    or delivery.claimed_content_revision is null
    or delivery.authority_evaluated_at is null
  then
    raise exception 'Supplier email claim proof is incomplete' using errcode = '22023';
  end if;

  if action_row.id is distinct from delivery.approved_action_id
    or action_row.status <> 'approved'
    or action_row.expected_impact->'approvedSendContent'->>'version'
      is distinct from delivery.content_version
    or action_row.expected_impact->'approvedSendContent'->>'fingerprint'
      is distinct from delivery.content_fingerprint
    or action_row.expected_impact->'approvedSendContent'->'contentRevision'
      is distinct from pg_catalog.to_jsonb(delivery.claimed_content_revision)
    or action_row.expected_impact->'approvedSendContent'->>'from'
      is distinct from delivery.claimed_from
    or action_row.expected_impact->'approvedSendContent'->>'to'
      is distinct from delivery.claimed_to
    or action_row.expected_impact->'approvedSendContent'->>'subject'
      is distinct from delivery.claimed_subject
    or (
      is_v2 and (
        action_row.expected_impact->>'supplierId' is distinct from delivery.supplier_id::text
        or action_row.expected_impact->'approvedSendContent'->>'supplierId'
          is distinct from delivery.supplier_id::text
      )
    )
    or order_row.status <> 'draft'
    or order_row.send_content_revision <> delivery.claimed_content_revision
  then
    raise exception 'Supplier email claim no longer matches the durable order'
      using errcode = '22023';
  end if;

  perform 1 from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved'
  order by recommendation.id for update;
  select pg_catalog.array_agg(recommendation.id order by recommendation.id)
  into current_ids from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved'
    and recommendation.supplier_id = order_row.supplier_id;
  select pg_catalog.array_agg(distinct claimed_id order by claimed_id)
  into normalized_claimed_ids
  from unnest(delivery.claimed_recommendation_ids) claimed_id;
  if normalized_claimed_ids is distinct from delivery.claimed_recommendation_ids
    or current_ids is distinct from delivery.claimed_recommendation_ids
  then
    raise exception 'Supplier email claimed line set cannot be proven' using errcode = '22023';
  end if;

  update private.supplier_email_deliveries candidate
  set status = 'sent', provider_message_id = p_provider_message_id,
    provider_accepted_at = pg_catalog.now(), last_error_code = null,
    updated_at = pg_catalog.now()
  where candidate.id = delivery.id;
  update public.supplier_orders orders
  set status = 'sent', email_provider = 'gmail',
    provider_message_id = p_provider_message_id, sent_at = pg_catalog.now(),
    sent_by_user_id = p_actor_user_id
  where orders.restaurant_id = p_restaurant_id
    and orders.id = p_order_id and orders.status = 'draft'
  returning * into order_row;
  if not found then
    raise exception 'Supplier order is not sendable' using errcode = '22023';
  end if;

  update public.purchase_recommendations recommendation
  set status = 'ordered'
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = any(delivery.claimed_recommendation_ids)
    and recommendation.supplier_order_id = p_order_id
    and recommendation.supplier_id = order_row.supplier_id
    and recommendation.status = 'approved';
  get diagnostics changed_count = row_count;
  if changed_count <> pg_catalog.cardinality(delivery.claimed_recommendation_ids) then
    raise exception 'Supplier email claimed line completion was incomplete'
      using errcode = '22023';
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, 'supplier_order_sent',
    'supplier_orders', p_order_id,
    pg_catalog.jsonb_build_object(
      'provider', 'gmail', 'provider_message_id', p_provider_message_id,
      'supplier_id', coalesce(delivery.supplier_id, order_row.supplier_id),
      'ordered_recommendation_count', changed_count,
      'content_version', delivery.content_version,
      'content_fingerprint', delivery.content_fingerprint,
      'authority_version', delivery.authority_version,
      'authority_fingerprint', delivery.authority_fingerprint
    )
  );
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.to_jsonb(recommendation) order by recommendation.id
  ), '[]'::jsonb)
  into ordered_rows from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = any(delivery.claimed_recommendation_ids)
    and recommendation.status = 'ordered';
  return pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'supplierId', coalesce(delivery.supplier_id, order_row.supplier_id),
    'externalIdentityChangedDuringClaim', delivery.external_identity_changed_during_claim,
    'order', pg_catalog.to_jsonb(order_row),
    'ordered_recommendations', ordered_rows
  );
end;
$$;

revoke all on function private.service_complete_supplier_email_send(
  uuid, uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function private.service_complete_supplier_email_send(
  uuid, uuid, uuid, uuid, text
) to service_role;

create or replace function private.guard_supplier_order_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.restaurant_id is distinct from new.restaurant_id
    or old.supplier_id is distinct from new.supplier_id
  then
    raise exception 'Supplier order identity is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_supplier_order_identity()
from public, anon, authenticated, service_role;
drop trigger if exists guard_supplier_order_identity on public.supplier_orders;
create trigger guard_supplier_order_identity
before update of restaurant_id, supplier_id on public.supplier_orders
for each row execute function private.guard_supplier_order_identity();

-- Remove retired name-authority entry points after every live trigger/caller
-- has moved to the UUID overloads above.
drop function private.bump_supplier_send_revision_for_external_identity(uuid, text[]);
drop function public.upsert_supplier_recipient(uuid, text, text);

drop function public.upsert_restaurant_autonomy_rule(
  uuid, text, text, smallint, boolean, boolean, bigint, text,
  text, uuid, time without time zone, time without time zone
);

create or replace function public.upsert_restaurant_autonomy_rule(
  p_restaurant_id uuid,
  p_action_type text,
  p_operational_category text,
  p_maximum_autonomy_level smallint,
  p_requires_approval boolean,
  p_enabled boolean,
  p_spend_limit_cents bigint default null,
  p_supplier_id uuid default null,
  p_communication_type text default null,
  p_location_id uuid default null,
  p_allowed_start_time time default null,
  p_allowed_end_time time default null
)
returns public.restaurant_autonomy_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  rule_row public.restaurant_autonomy_rules;
  supplier_display_name text;
begin
  if auth.uid() is null
    or not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin'])
  then
    raise exception 'Owner or admin access required' using errcode = '42501';
  end if;
  if nullif(pg_catalog.btrim(p_action_type), '') is null
    or p_operational_category not in (
      'inventory', 'orders', 'sales', 'team', 'waste', 'tasks',
      'integrations', 'settings'
    )
    or p_maximum_autonomy_level not between 1 and 5
    or p_spend_limit_cents is not null and p_spend_limit_cents < 0
  then
    raise exception 'Invalid autonomy rule' using errcode = '22023';
  end if;
  if p_supplier_id is not null then
    select supplier.display_name into supplier_display_name
    from public.suppliers supplier
    where supplier.restaurant_id = p_restaurant_id
      and supplier.id = p_supplier_id;
    if not found then
      raise exception 'Supplier identity is not valid for this restaurant'
        using errcode = '22023';
    end if;
  end if;

  insert into public.restaurant_autonomy_rules (
    restaurant_id, location_id, action_type, operational_category,
    maximum_autonomy_level, requires_approval, enabled, spend_limit_cents,
    supplier_id, supplier_name, communication_type, allowed_start_time,
    allowed_end_time, created_by, updated_by
  ) values (
    p_restaurant_id, p_location_id,
    pg_catalog.left(pg_catalog.btrim(p_action_type), 120),
    p_operational_category, p_maximum_autonomy_level,
    coalesce(p_requires_approval, true), coalesce(p_enabled, false),
    p_spend_limit_cents, p_supplier_id, supplier_display_name,
    nullif(pg_catalog.left(pg_catalog.btrim(p_communication_type), 80), ''),
    p_allowed_start_time, p_allowed_end_time, auth.uid(), auth.uid()
  )
  on conflict on constraint restaurant_autonomy_rules_scope_key do update
  set operational_category = excluded.operational_category,
    maximum_autonomy_level = excluded.maximum_autonomy_level,
    requires_approval = excluded.requires_approval,
    enabled = excluded.enabled,
    spend_limit_cents = excluded.spend_limit_cents,
    supplier_name = excluded.supplier_name,
    allowed_start_time = excluded.allowed_start_time,
    allowed_end_time = excluded.allowed_end_time,
    updated_by = auth.uid(), updated_at = pg_catalog.now()
  returning * into rule_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'autonomy_rule_updated',
    'restaurant_autonomy_rules', rule_row.id,
    pg_catalog.jsonb_build_object(
      'action_type', rule_row.action_type,
      'supplier_id', rule_row.supplier_id,
      'maximum_autonomy_level', rule_row.maximum_autonomy_level,
      'requires_approval', rule_row.requires_approval,
      'enabled', rule_row.enabled,
      'has_spend_limit', rule_row.spend_limit_cents is not null
    )
  );
  return rule_row;
end;
$$;

revoke all on function public.upsert_restaurant_autonomy_rule(
  uuid, text, text, smallint, boolean, boolean, bigint, uuid,
  text, uuid, time without time zone, time without time zone
) from public, anon, authenticated, service_role;
grant execute on function public.upsert_restaurant_autonomy_rule(
  uuid, text, text, smallint, boolean, boolean, bigint, uuid,
  text, uuid, time without time zone, time without time zone
) to authenticated;

create or replace function public.save_restaurant_setup(
  p_restaurant_id uuid,
  p_inventory_items jsonb default '[]'::jsonb,
  p_suppliers jsonb default '[]'::jsonb,
  p_recipe_mappings jsonb default '[]'::jsonb,
  p_pos_sales jsonb default '[]'::jsonb,
  p_attachments jsonb default '[]'::jsonb,
  p_skipped_recipe_ingredients integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_inventory jsonb := coalesce(p_inventory_items, '[]'::jsonb);
  safe_suppliers jsonb := coalesce(p_suppliers, '[]'::jsonb);
  safe_mappings jsonb := coalesce(p_recipe_mappings, '[]'::jsonb);
  safe_sales jsonb := coalesce(p_pos_sales, '[]'::jsonb);
  safe_attachments jsonb := coalesce(p_attachments, '[]'::jsonb);
  supplier_ids jsonb := '{}'::jsonb;
  payload record;
  existing_id uuid;
  inventory_id uuid;
  resolved_supplier_id uuid;
  previous_supplier_id uuid;
  canonical_supplier_name text;
  setup_fingerprint text;
  supplier_count integer := 0;
  inventory_count integer := 0;
  mapping_count integer := 0;
  sale_count integer := 0;
  attachment_count integer := 0;
  lock_supplier_id uuid;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if p_skipped_recipe_ingredients is null
    or p_skipped_recipe_ingredients not between 0 and 1000
  then
    raise exception 'Invalid skipped recipe count' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(safe_inventory) <> 'array'
    or pg_catalog.jsonb_typeof(safe_suppliers) <> 'array'
    or pg_catalog.jsonb_typeof(safe_mappings) <> 'array'
    or pg_catalog.jsonb_typeof(safe_sales) <> 'array'
    or pg_catalog.jsonb_typeof(safe_attachments) <> 'array'
  then
    raise exception 'Setup payloads must be JSON arrays' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(safe_inventory) > 250
    or pg_catalog.jsonb_array_length(safe_suppliers) > 100
    or pg_catalog.jsonb_array_length(safe_mappings) > 1000
    or pg_catalog.jsonb_array_length(safe_sales) > 1000
    or pg_catalog.jsonb_array_length(safe_attachments) > 25
  then
    raise exception 'Setup payload exceeds supported limits' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_restaurant_id::text || E'\x1fsetup', 0
  ));

  if (
    select count(*) from pg_catalog.jsonb_to_recordset(safe_suppliers)
      as value(client_reference_id text, display_name text, email text)
  ) <> (
    select count(distinct value.client_reference_id)
    from pg_catalog.jsonb_to_recordset(safe_suppliers)
      as value(client_reference_id text, display_name text, email text)
  ) or (
    select count(*) from pg_catalog.jsonb_to_recordset(safe_suppliers)
      as value(client_reference_id text, display_name text, email text)
  ) <> (
    select count(distinct private.normalize_supplier_name(value.display_name))
    from pg_catalog.jsonb_to_recordset(safe_suppliers)
      as value(client_reference_id text, display_name text, email text)
  ) then
    raise exception 'Setup supplier references and names must be unique'
      using errcode = '22023';
  end if;

  -- Exact normalized-name discovery is bounded to initial setup creation. The
  -- resulting UUID map, never the name, authorizes every inventory write.
  for payload in
    select * from pg_catalog.jsonb_to_recordset(safe_suppliers) as value(
      client_reference_id text, display_name text, email text
    )
  loop
    payload.client_reference_id := pg_catalog.btrim(payload.client_reference_id);
    canonical_supplier_name := private.normalize_supplier_display_name(payload.display_name);
    payload.email := nullif(pg_catalog.lower(pg_catalog.btrim(payload.email)), '');
    if pg_catalog.length(payload.client_reference_id) not between 1 and 200
      or canonical_supplier_name is null
      or pg_catalog.length(canonical_supplier_name) > 160
      or coalesce(payload.display_name, '') ~ '[[:cntrl:]]'
      or payload.email is not null and (
        pg_catalog.length(payload.email) not between 3 and 254
        or payload.email ~ '[[:cntrl:]]'
        or payload.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    then
      raise exception 'Invalid supplier setup row' using errcode = '22023';
    end if;

    select supplier.id into resolved_supplier_id
    from public.suppliers supplier
    where supplier.restaurant_id = p_restaurant_id
      and supplier.normalized_name = private.normalize_supplier_name(canonical_supplier_name)
    for update;
    if resolved_supplier_id is null then
      insert into public.suppliers (restaurant_id, display_name, normalized_name)
      values (
        p_restaurant_id, canonical_supplier_name,
        private.normalize_supplier_name(canonical_supplier_name)
      ) returning id into resolved_supplier_id;
    end if;
    perform private.lock_supplier_authority(p_restaurant_id, resolved_supplier_id);
    supplier_ids := supplier_ids || pg_catalog.jsonb_build_object(
      payload.client_reference_id, resolved_supplier_id
    );

    select recipient.id into existing_id
    from public.supplier_recipients recipient
    where recipient.restaurant_id = p_restaurant_id
      and recipient.supplier_id = resolved_supplier_id
    for update;
    if existing_id is null then
      insert into public.supplier_recipients (
        restaurant_id, supplier_id, supplier_name, email
      ) values (
        p_restaurant_id, resolved_supplier_id, canonical_supplier_name, payload.email
      );
    else
      update public.supplier_recipients recipient
      set supplier_name = canonical_supplier_name, email = payload.email
      where recipient.restaurant_id = p_restaurant_id
        and recipient.id = existing_id;
    end if;
    supplier_count := supplier_count + 1;
  end loop;

  for payload in
    select * from pg_catalog.jsonb_to_recordset(safe_inventory) as value(
      item_name text, category text, unit text, current_quantity numeric,
      par_level numeric, reorder_threshold numeric,
      estimated_unit_cost numeric, supplier_client_reference_id text
    )
  loop
    payload.item_name := pg_catalog.btrim(payload.item_name);
    payload.category := pg_catalog.btrim(payload.category);
    payload.unit := pg_catalog.btrim(payload.unit);
    payload.supplier_client_reference_id := pg_catalog.btrim(
      payload.supplier_client_reference_id
    );
    begin
      resolved_supplier_id := (supplier_ids->>payload.supplier_client_reference_id)::uuid;
    exception when invalid_text_representation then
      resolved_supplier_id := null;
    end;
    select supplier.display_name into canonical_supplier_name
    from public.suppliers supplier
    where supplier.restaurant_id = p_restaurant_id
      and supplier.id = resolved_supplier_id;
    if pg_catalog.length(payload.item_name) not between 1 and 160
      or pg_catalog.length(payload.category) not between 1 and 120
      or pg_catalog.length(payload.unit) not between 1 and 40
      or resolved_supplier_id is null or canonical_supplier_name is null
      or payload.current_quantity is null or payload.current_quantity not between 0 and 1000000
      or payload.par_level is null or payload.par_level not between 0 and 1000000
      or payload.reorder_threshold is null or payload.reorder_threshold not between 0 and 1000000
      or payload.estimated_unit_cost is null or payload.estimated_unit_cost not between 0 and 1000000
    then
      raise exception 'Invalid inventory setup row' using errcode = '22023';
    end if;

    existing_id := null;
    previous_supplier_id := null;
    select item.id, item.supplier_id into existing_id, previous_supplier_id
    from public.inventory_items item
    where item.restaurant_id = p_restaurant_id
      and pg_catalog.lower(pg_catalog.btrim(item.item_name))
        = pg_catalog.lower(payload.item_name)
    order by item.last_updated, item.id limit 1 for update;

    for lock_supplier_id in
      select distinct candidate.id
      from unnest(array[previous_supplier_id, resolved_supplier_id]) candidate(id)
      where candidate.id is not null order by candidate.id
    loop
      perform private.lock_supplier_authority(p_restaurant_id, lock_supplier_id);
    end loop;

    if existing_id is null then
      insert into public.inventory_items (
        restaurant_id, item_name, category, unit, current_quantity, par_level,
        reorder_threshold, estimated_unit_cost, supplier_id, supplier_name
      ) values (
        p_restaurant_id, payload.item_name, payload.category, payload.unit,
        payload.current_quantity, payload.par_level, payload.reorder_threshold,
        payload.estimated_unit_cost, resolved_supplier_id, canonical_supplier_name
      );
    else
      if previous_supplier_id is distinct from resolved_supplier_id then
        if exists (
          select 1 from public.purchase_recommendations recommendation
          where recommendation.restaurant_id = p_restaurant_id
            and recommendation.inventory_item_id = existing_id
            and recommendation.status in ('approved', 'ordered')
        ) then
          raise exception 'Existing purchasing must be finished before setup supplier reassignment'
            using errcode = '55000';
        end if;
        delete from public.purchase_recommendations recommendation
        where recommendation.restaurant_id = p_restaurant_id
          and recommendation.inventory_item_id = existing_id
          and recommendation.status = 'pending';
      end if;
      update public.inventory_items item
      set item_name = payload.item_name, category = payload.category,
        unit = payload.unit, current_quantity = payload.current_quantity,
        par_level = payload.par_level,
        reorder_threshold = payload.reorder_threshold,
        estimated_unit_cost = payload.estimated_unit_cost,
        supplier_id = resolved_supplier_id,
        supplier_name = canonical_supplier_name,
        last_updated = pg_catalog.now()
      where item.restaurant_id = p_restaurant_id and item.id = existing_id;
    end if;
    inventory_count := inventory_count + 1;
  end loop;

  for payload in
    select * from pg_catalog.jsonb_to_recordset(safe_mappings) as value(
      menu_item_name text, inventory_item_name text,
      quantity_used_per_sale numeric, unit text
    )
  loop
    payload.menu_item_name := pg_catalog.btrim(payload.menu_item_name);
    payload.inventory_item_name := pg_catalog.btrim(payload.inventory_item_name);
    payload.unit := pg_catalog.btrim(payload.unit);
    if pg_catalog.length(payload.menu_item_name) not between 1 and 200
      or pg_catalog.length(payload.inventory_item_name) not between 1 and 160
      or pg_catalog.length(payload.unit) not between 1 and 40
      or payload.quantity_used_per_sale is null
      or payload.quantity_used_per_sale <= 0
      or payload.quantity_used_per_sale > 10000
    then
      raise exception 'Invalid recipe setup row' using errcode = '22023';
    end if;
    inventory_id := null;
    select item.id into inventory_id from public.inventory_items item
    where item.restaurant_id = p_restaurant_id
      and pg_catalog.lower(pg_catalog.btrim(item.item_name))
        = pg_catalog.lower(payload.inventory_item_name)
    order by item.last_updated, item.id limit 1 for update;
    if inventory_id is null then
      raise exception 'Recipe inventory item was not persisted' using errcode = '22023';
    end if;
    existing_id := null;
    select ingredient.id into existing_id
    from public.menu_item_ingredients ingredient
    where ingredient.restaurant_id = p_restaurant_id
      and ingredient.inventory_item_id = inventory_id
      and pg_catalog.lower(pg_catalog.btrim(ingredient.menu_item_name))
        = pg_catalog.lower(payload.menu_item_name)
    order by ingredient.id limit 1 for update;
    if existing_id is null then
      insert into public.menu_item_ingredients (
        restaurant_id, menu_item_name, inventory_item_id,
        quantity_used_per_sale, unit
      ) values (
        p_restaurant_id, payload.menu_item_name, inventory_id,
        payload.quantity_used_per_sale, payload.unit
      );
    else
      update public.menu_item_ingredients ingredient
      set menu_item_name = payload.menu_item_name,
        quantity_used_per_sale = payload.quantity_used_per_sale,
        unit = payload.unit
      where ingredient.restaurant_id = p_restaurant_id
        and ingredient.id = existing_id;
    end if;
    mapping_count := mapping_count + 1;
  end loop;

  for payload in
    select * from pg_catalog.jsonb_to_recordset(safe_sales) as value(
      source_record_id text, sale_date date, item_name text, category text,
      quantity_sold numeric, gross_sales numeric, net_sales numeric, source_pos text
    )
  loop
    payload.source_record_id := pg_catalog.btrim(payload.source_record_id);
    payload.item_name := pg_catalog.btrim(payload.item_name);
    payload.category := pg_catalog.btrim(payload.category);
    payload.source_pos := pg_catalog.btrim(payload.source_pos);
    if pg_catalog.length(payload.source_record_id) not between 1 and 200
      or payload.sale_date is null
      or pg_catalog.length(payload.item_name) not between 1 and 200
      or pg_catalog.length(payload.category) not between 1 and 120
      or payload.quantity_sold is null or payload.quantity_sold <= 0
      or payload.quantity_sold > 100000
      or payload.gross_sales is null or payload.gross_sales not between 0 and 10000000
      or payload.net_sales is null or payload.net_sales not between 0 and 10000000
      or payload.source_pos <> 'Manual CSV Upload'
    then
      raise exception 'Invalid POS setup row' using errcode = '22023';
    end if;
    insert into public.pos_sales (
      restaurant_id, source_record_id, sale_date, item_name, category,
      quantity_sold, gross_sales, net_sales, source_pos
    ) values (
      p_restaurant_id, payload.source_record_id, payload.sale_date,
      payload.item_name, payload.category, payload.quantity_sold,
      payload.gross_sales, payload.net_sales, payload.source_pos
    ) on conflict (restaurant_id, source_pos, source_record_id)
      where source_record_id is not null
    do update set sale_date = excluded.sale_date, item_name = excluded.item_name,
      category = excluded.category, quantity_sold = excluded.quantity_sold,
      gross_sales = excluded.gross_sales, net_sales = excluded.net_sales;
    sale_count := sale_count + 1;
  end loop;

  for payload in
    select * from pg_catalog.jsonb_to_recordset(safe_attachments) as value(
      client_reference_id text, kind text, label text, status text
    )
  loop
    payload.client_reference_id := pg_catalog.btrim(payload.client_reference_id);
    payload.label := pg_catalog.btrim(payload.label);
    if pg_catalog.length(payload.client_reference_id) not between 1 and 200
      or pg_catalog.length(payload.label) not between 1 and 240
      or payload.kind not in ('csv', 'screenshot')
      or payload.status not in ('queued', 'review_needed')
    then
      raise exception 'Invalid setup attachment row' using errcode = '22023';
    end if;
    existing_id := null;
    select attachment.id into existing_id from public.setup_attachments attachment
    where attachment.restaurant_id = p_restaurant_id
      and attachment.metadata->>'client_reference_id' = payload.client_reference_id
    order by attachment.created_at limit 1 for update;
    if existing_id is null then
      insert into public.setup_attachments (
        restaurant_id, kind, label, status, metadata, created_by
      ) values (
        p_restaurant_id, payload.kind, payload.label, payload.status,
        pg_catalog.jsonb_build_object(
          'source', 'setup_onboarding',
          'client_reference_id', payload.client_reference_id,
          'storage_status', 'metadata_only'
        ), auth.uid()
      );
    else
      update public.setup_attachments attachment
      set kind = payload.kind, label = payload.label, status = payload.status
      where attachment.restaurant_id = p_restaurant_id
        and attachment.id = existing_id;
    end if;
    attachment_count := attachment_count + 1;
  end loop;

  setup_fingerprint := pg_catalog.md5(
    safe_inventory::text || safe_suppliers::text || safe_mappings::text
      || safe_sales::text || safe_attachments::text
  );
  if not exists (
    select 1 from public.audit_logs audit
    where audit.restaurant_id = p_restaurant_id
      and audit.action = 'setup_completed'
      and audit.metadata->>'setup_fingerprint' = setup_fingerprint
  ) then
    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id, auth.uid(), 'setup_completed', 'restaurants', p_restaurant_id,
      pg_catalog.jsonb_build_object(
        'inventory_items_saved', inventory_count,
        'supplier_recipients_saved', supplier_count,
        'recipe_mappings_saved', mapping_count,
        'pos_sales_rows_saved', sale_count,
        'attachment_metadata_saved', attachment_count,
        'skipped_recipe_ingredients', p_skipped_recipe_ingredients,
        'setup_fingerprint', setup_fingerprint,
        'supplier_identity', 'durable_uuid'
      )
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'inventory_items_saved', inventory_count,
    'supplier_recipients_saved', supplier_count,
    'recipe_mappings_saved', mapping_count,
    'pos_sales_rows_saved', sale_count,
    'attachment_metadata_saved', attachment_count,
    'skipped_recipe_ingredients', p_skipped_recipe_ingredients,
    'setup_fingerprint', setup_fingerprint
  );
end;
$$;

revoke all on function public.save_restaurant_setup(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, integer
) from public, anon, authenticated, service_role;
grant execute on function public.save_restaurant_setup(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, integer
) to authenticated;

-- Inventory policy edits remain service-serialized, but mutable supplier text
-- is no longer an accepted patch. Supplier reassignment has its own actor-
-- authorized, two-supplier lock boundary above.
create or replace function private.service_update_inventory_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_expected_revision bigint,
  p_patch jsonb,
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
  safe_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  item_row public.inventory_items%rowtype;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  select state.planning_revision into current_revision
  from private.restaurant_signal_state state
  where state.restaurant_id = p_restaurant_id for update;
  if current_revision is distinct from p_expected_revision then
    raise exception 'Planning snapshot changed; retry from a fresh snapshot'
      using errcode = '40001';
  end if;
  if pg_catalog.jsonb_typeof(safe_patch) <> 'object'
    or safe_patch = '{}'::jsonb
    or safe_patch - array['par_level', 'reorder_threshold'] <> '{}'::jsonb
  then
    raise exception 'Inventory patch contains unsupported fields' using errcode = '22023';
  end if;
  select * into item_row from public.inventory_items item
  where item.restaurant_id = p_restaurant_id and item.id = p_inventory_item_id
  for update;
  if not found then raise exception 'Inventory item not found' using errcode = 'P0002'; end if;
  item_row.par_level := case when safe_patch ? 'par_level'
    then (safe_patch->>'par_level')::numeric else item_row.par_level end;
  item_row.reorder_threshold := case when safe_patch ? 'reorder_threshold'
    then (safe_patch->>'reorder_threshold')::numeric else item_row.reorder_threshold end;
  if item_row.par_level not between 0 and 1000000
    or item_row.reorder_threshold not between 0 and 1000000
  then
    raise exception 'Inventory patch is outside supported limits' using errcode = '22023';
  end if;
  update public.inventory_items item
  set par_level = item_row.par_level,
    reorder_threshold = item_row.reorder_threshold,
    last_updated = pg_catalog.clock_timestamp()
  where item.restaurant_id = p_restaurant_id and item.id = p_inventory_item_id
  returning * into item_row;
  select state.planning_revision into commit_revision
  from private.restaurant_signal_state state
  where state.restaurant_id = p_restaurant_id;
  perform private.commit_operational_signals(
    p_actor_user_id, p_restaurant_id, commit_revision,
    p_recommendations, p_insights, false, '{}'::jsonb
  );
  return pg_catalog.to_jsonb(item_row);
end;
$$;

revoke all on function private.service_update_inventory_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function private.service_update_inventory_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb
) to service_role;

-- Supplier-delivery recording predates durable supplier identity and builds a
-- recommendation-affecting reliability-memory dedupe key from display text.
-- Keep that mature delivery implementation as a revoked compatibility base,
-- while the active entry point projects its transient key onto the stable
-- tenant + supplier UUID. Historical name-keyed memory is preserved under an
-- explicit legacy key rather than being attributed to whichever same-name
-- supplier happens to record the next delivery.
alter function public.record_supplier_delivery(
  uuid, uuid, text, timestamptz, jsonb, numeric, text
) rename to record_supplier_delivery_mise_003b_name_base;

revoke all on function public.record_supplier_delivery_mise_003b_name_base(
  uuid, uuid, text, timestamptz, jsonb, numeric, text
) from public, anon, authenticated, service_role;

create function public.record_supplier_delivery(
  p_restaurant_id uuid,
  p_supplier_order_id uuid,
  p_client_delivery_id text,
  p_received_at timestamptz,
  p_lines jsonb,
  p_invoice_total numeric default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_snapshot public.supplier_orders%rowtype;
  legacy_memory public.restaurant_memories%rowtype;
  durable_memory public.restaurant_memories%rowtype;
  base_result jsonb;
  legacy_memory_key text;
  durable_memory_key text;
  delivery_id uuid;
begin
  if auth.uid() is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  select * into order_snapshot
  from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id
    and orders.id = p_supplier_order_id;
  if not found then
    raise exception 'Supplier order not found' using errcode = 'P0002';
  end if;
  if order_snapshot.supplier_id is null then
    raise exception 'Supplier order lacks durable supplier identity'
      using errcode = '55000';
  end if;

  perform private.lock_supplier_authority(
    p_restaurant_id, order_snapshot.supplier_id
  );
  select * into order_snapshot
  from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id
    and orders.id = p_supplier_order_id
  for update;
  if not found then
    raise exception 'Supplier order not found' using errcode = 'P0002';
  end if;

  durable_memory_key := pg_catalog.format(
    'supplier-delivery-outcome:%s', order_snapshot.supplier_id
  );
  -- The revoked base can only locate its row through this legacy key. This is
  -- a transaction-local compatibility projection, never the durable identity.
  legacy_memory_key := pg_catalog.format(
    'supplier-delivery-outcome:%s',
    pg_catalog.lower(pg_catalog.btrim(order_snapshot.supplier_name))
  );

  select * into legacy_memory
  from public.restaurant_memories memory
  where memory.restaurant_id = p_restaurant_id
    and memory.dedupe_key = legacy_memory_key
  for update;
  if found then
    update public.restaurant_memories memory
    set dedupe_key = pg_catalog.format(
      'legacy-supplier-delivery-outcome:%s', legacy_memory.id
    )
    where memory.restaurant_id = p_restaurant_id
      and memory.id = legacy_memory.id;
  end if;

  select * into durable_memory
  from public.restaurant_memories memory
  where memory.restaurant_id = p_restaurant_id
    and memory.dedupe_key = durable_memory_key
  for update;
  if found then
    update public.restaurant_memories memory
    set dedupe_key = legacy_memory_key
    where memory.restaurant_id = p_restaurant_id
      and memory.id = durable_memory.id;
  end if;

  base_result := public.record_supplier_delivery_mise_003b_name_base(
    p_restaurant_id,
    p_supplier_order_id,
    p_client_delivery_id,
    p_received_at,
    p_lines,
    p_invoice_total,
    p_notes
  );

  update public.restaurant_memories memory
  set dedupe_key = durable_memory_key
  where memory.restaurant_id = p_restaurant_id
    and memory.dedupe_key = legacy_memory_key;

  delivery_id := nullif(base_result #>> '{delivery,id}', '')::uuid;
  if delivery_id is not null then
    update public.audit_logs audit
    set metadata = audit.metadata || pg_catalog.jsonb_build_object(
      'supplier_id', order_snapshot.supplier_id
    )
    where audit.restaurant_id = p_restaurant_id
      and audit.action = 'supplier_delivery_recorded'
      and audit.entity_table = 'supplier_deliveries'
      and audit.entity_id = delivery_id;
  end if;

  return base_result || pg_catalog.jsonb_build_object(
    'supplierId', order_snapshot.supplier_id
  );
end;
$$;

revoke all on function public.record_supplier_delivery(
  uuid, uuid, text, timestamptz, jsonb, numeric, text
) from public, anon, authenticated, service_role;
grant execute on function public.record_supplier_delivery(
  uuid, uuid, text, timestamptz, jsonb, numeric, text
) to authenticated;

comment on function public.record_supplier_delivery(
  uuid, uuid, text, timestamptz, jsonb, numeric, text
) is
  'Records a supplier delivery by immutable order ID and projects supplier reliability memory onto restaurant + supplier UUID. Historical name-keyed memory remains explicitly legacy.';
