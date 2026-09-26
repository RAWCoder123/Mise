-- MISE-005V: pin create_supplier / rename_supplier display_name cntrl
-- preflights to COLLATE "C".
--
-- public.create_supplier and public.rename_supplier still reject control
-- characters with bare POSIX [[:cntrl:]] on coalesce(p_display_name, '').
-- Bare [[:cntrl:]] follows database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; MISE-005B
-- pinned the suppliers display_name CHECK and normalize helpers to collate "C",
-- but left the authenticated mutator preflights on bare [[:cntrl:]].
--
-- Create/rename refuse with the same 22023 message before any durable write
-- when the raw display_name fails the length/cntrl gate. If LC_CTYPE drifted,
-- a mutator could accept display_name bytes a restored C-locale CHECK would
-- reject (or refuse ones the CHECK accepts) — breaking supplier create/rename
-- continuity after restore for the same operator-entered name bytes.
--
-- Scope:
--   - Rewrite public.create_supplier / public.rename_supplier so the
--     display_name cntrl preflight uses
--     (coalesce(p_display_name, '') collate "C") ~ '[[:cntrl:]]'
--   - Preserve revoke + grant EXECUTE to authenticated only
-- Does NOT reattach the suppliers display_name CHECK (MISE-005B), rewrite
-- normalize_supplier_* helpers, or touch save_restaurant_setup supplier
-- discovery. Must apply after MISE-003C. Prefer after MISE-005B so CHECK +
-- mutator pins land together; timestamp after 005U. Compose-safe alone on
-- main (create/rename unreplaced since 003c).

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
    or coalesce(p_display_name, '') collate "C" ~ '[[:cntrl:]]'
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
    or coalesce(p_display_name, '') collate "C" ~ '[[:cntrl:]]'
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
