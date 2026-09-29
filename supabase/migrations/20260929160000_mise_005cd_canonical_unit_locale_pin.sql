-- MISE-005CD: pin inventory_items and purchase_decision_events
-- canonical_unit CHECKs (and verify_inventory_item_canonical_unit writer)
-- to COLLATE "C", preserving the exact-token allowlist.
--
-- public.inventory_items stores verified conversion identity under a bare IN
-- allowlist from inventory_item_canonical_unit_authority:
--   canonical_unit is null or canonical_unit in ('g', 'ml', 'each')
-- public.purchase_decision_events stores action-time conversion identity under
-- a bare IN allowlist from mise_004a_purchase_decision_memory:
--   canonical_unit in ('g', 'ml', 'each')
-- public.verify_inventory_item_canonical_unit mirrors that with bare:
--   p_canonical_unit not in ('g', 'ml', 'each')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII dimension tokens
-- only:
--   'g'    — mass
--   'ml'   — volume
--   'each' — count
--
-- canonical_unit is conversion identity for inventory authority and append-only
-- purchase-decision evidence. POSIX character classes follow database
-- LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; later 005* tips pinned machine-identity and provenance
-- allowlists under COLLATE "C", but left these bare-IN canonical_unit CHECKs
-- and the verify writer gate unpinned.
--
-- If LC_CTYPE drifted under a bare-IN canonical_unit CHECK, dump/restore could
-- accept conversion-identity bytes the restored C-locale path (and sibling
-- machine-identity gates) would refuse — or the reverse — breaking inventory
-- conversion and purchase-decision evidence continuity across restore. The
-- same drift on the verify writer could accept bytes the CHECK would refuse
-- (or the reverse).
--
-- Open MISE-005H (#416) pins recommendation_unit cntrl on
-- purchase_decision_events; MISE-005BV (#482) pins evidence_version; neither
-- rewrites canonical_unit. Alone on main OK.
--
-- Scope:
--   - Replace inventory_items_canonical_unit_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C" (null remains legal for draft items)
--   - Replace purchase_decision_events_canonical_unit_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
--   - Rewrite public.verify_inventory_item_canonical_unit so the allowlist
--     gate uses the same COLLATE "C" contract
--   - Preserve revoke from public/anon/authenticated/service_role + grant
--     EXECUTE to authenticated only
-- Does NOT rewrite record_purchase_decision_* writers, inventory_events /
-- recipe_ingredients / supplier_items / supplier_delivery_items sibling
-- canonical_unit CHECKs, normalize_inventory_item_canonical_unit,
-- recommendation_unit (#416), evidence_version (#482), or contested stacks.
-- Timestamp after MISE-005CC (#489).

alter table public.inventory_items
  drop constraint if exists inventory_items_canonical_unit_check;

alter table public.inventory_items
  add constraint inventory_items_canonical_unit_check
  check (
    canonical_unit is null
    or (
      canonical_unit in ('g', 'ml', 'each')
      and canonical_unit collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
    )
  );

comment on constraint inventory_items_canonical_unit_check
  on public.inventory_items is
  'MISE-005CD: exact g/ml/each allowlist plus ASCII shape under COLLATE "C". Null remains legal for unverified draft items.';

comment on column public.inventory_items.canonical_unit is
  'Verified canonical dimension for inventory conversion. Allowed values: g, ml, each under COLLATE "C". Null while draft.';

alter table public.purchase_decision_events
  drop constraint if exists purchase_decision_events_canonical_unit_check;

alter table public.purchase_decision_events
  add constraint purchase_decision_events_canonical_unit_check
  check (
    canonical_unit in ('g', 'ml', 'each')
    and canonical_unit collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint purchase_decision_events_canonical_unit_check
  on public.purchase_decision_events is
  'MISE-005CD: exact g/ml/each allowlist plus ASCII shape under COLLATE "C". Action-time purchase-decision conversion identity.';

comment on column public.purchase_decision_events.canonical_unit is
  'Action-time canonical dimension for purchase-decision evidence. Allowed values: g, ml, each under COLLATE "C".';

create or replace function public.verify_inventory_item_canonical_unit(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_canonical_unit text,
  p_canonical_quantity_per_unit numeric
)
returns public.inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_item public.inventory_items;
  inferred_unit text;
  inferred_quantity numeric;
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
  if p_canonical_unit is null
    or p_canonical_unit not in ('g', 'ml', 'each')
    or p_canonical_unit collate "C" !~ '^[A-Za-z0-9._-]{1,80}$'
  then
    raise exception 'Canonical unit must be g, ml, or each' using errcode = '22023';
  end if;
  if p_canonical_quantity_per_unit is null
    or p_canonical_quantity_per_unit <= 0
    or p_canonical_quantity_per_unit > 1000000000
  then
    raise exception 'Canonical quantity per inventory unit is invalid' using errcode = '22023';
  end if;

  select
    private.canonical_unit_for_standard_unit(item.unit),
    private.canonical_quantity_per_standard_unit(item.unit)
  into inferred_unit, inferred_quantity
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id
    and item.id = p_inventory_item_id;

  if not found then
    raise exception 'Inventory item not found for restaurant' using errcode = '23503';
  end if;
  if inferred_unit is not null
    and (
      inferred_unit <> p_canonical_unit
      or inferred_quantity <> p_canonical_quantity_per_unit
    )
  then
    raise exception 'Standard-unit canonical conversion cannot be overridden' using errcode = '22023';
  end if;

  update public.inventory_items item
  set
    canonical_unit = p_canonical_unit,
    canonical_quantity_per_unit = p_canonical_quantity_per_unit,
    canonical_unit_verification_status = 'verified',
    canonical_unit_verified_at = now(),
    canonical_unit_verified_by = auth.uid(),
    last_updated = now()
  where item.restaurant_id = p_restaurant_id
    and item.id = p_inventory_item_id
  returning item.* into verified_item;

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
    'inventory_item.canonical_unit_verified',
    'inventory_items',
    verified_item.id,
    jsonb_build_object(
      'canonical_unit', verified_item.canonical_unit,
      'canonical_quantity_per_unit', verified_item.canonical_quantity_per_unit
    )
  );

  return verified_item;
end;
$$;

comment on function public.verify_inventory_item_canonical_unit(uuid, uuid, text, numeric) is
  'MISE-005CD: verify inventory item canonical conversion under exact g/ml/each allowlist plus COLLATE "C" ASCII shape; owner/admin/manager only.';

revoke all on function public.verify_inventory_item_canonical_unit(uuid, uuid, text, numeric) from public, anon, authenticated, service_role;

grant execute on function public.verify_inventory_item_canonical_unit(uuid, uuid, text, numeric) to authenticated;
