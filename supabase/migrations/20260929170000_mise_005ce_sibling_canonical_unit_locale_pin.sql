-- MISE-005CE: pin sibling canonical_unit CHECKs to COLLATE "C",
-- preserving the exact-token allowlist on inventory_events,
-- recipe_ingredients, modifier_recipe_adjustments,
-- ingredient_substitutions, supplier_items, and supplier_delivery_items.
--
-- These tables store conversion identity under bare IN allowlists from
-- operational_data_foundation_inventory_ledger and
-- operational_backend_foundation:
--   NOT NULL tables: canonical_unit in ('g', 'ml', 'each')
--   supplier_items:  canonical_unit is null or canonical_unit in ('g', 'ml', 'each')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII dimension tokens
-- only:
--   'g'    — mass
--   'ml'   — volume
--   'each' — count
--
-- canonical_unit is conversion identity for inventory events, recipe lines,
-- modifier deltas, substitutions, supplier pack mapping, and delivery lines.
-- POSIX character classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; MISE-005CD
-- (#490) pinned inventory_items / purchase_decision_events + verify writer,
-- but left these sibling bare-IN CHECKs unpinned.
--
-- If LC_CTYPE drifted under a bare-IN canonical_unit CHECK, dump/restore could
-- accept conversion-identity bytes the restored C-locale path (and sibling
-- machine-identity gates) would refuse — or the reverse — breaking inventory
-- event, recipe, substitution, supplier-pack, and delivery conversion
-- continuity across restore.
--
-- Open MISE-005BR (#478) pins inventory_events identity (source /
-- client_event_id / idempotency_key); it does not rewrite canonical_unit.
-- MISE-005BH (#468) pins modifier external_modifier_id; it does not rewrite
-- canonical_unit. Alone on main OK.
--
-- Scope:
--   - Replace sibling *_canonical_unit_check constraints with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
--   - supplier_items keeps null-or draft shape
-- Does NOT rewrite inventory event / delivery / recipe writers,
-- enforce_inventory_event_canonical_unit, verify_inventory_item_canonical_unit,
-- inventory_items / purchase_decision_events (#490), inventory_events identity
-- (#478), or contested stacks.
-- Timestamp after MISE-005CD (#490).

alter table public.inventory_events
  drop constraint if exists inventory_events_canonical_unit_check;

alter table public.inventory_events
  add constraint inventory_events_canonical_unit_check
  check (
    canonical_unit in ('g', 'ml', 'each')
    and canonical_unit collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint inventory_events_canonical_unit_check
  on public.inventory_events is
  'MISE-005CE: exact g/ml/each allowlist plus ASCII shape under COLLATE "C". Inventory event conversion identity.';

comment on column public.inventory_events.canonical_unit is
  'Canonical dimension for inventory event quantities. Allowed values: g, ml, each under COLLATE "C".';

alter table public.recipe_ingredients
  drop constraint if exists recipe_ingredients_canonical_unit_check;

alter table public.recipe_ingredients
  add constraint recipe_ingredients_canonical_unit_check
  check (
    canonical_unit in ('g', 'ml', 'each')
    and canonical_unit collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint recipe_ingredients_canonical_unit_check
  on public.recipe_ingredients is
  'MISE-005CE: exact g/ml/each allowlist plus ASCII shape under COLLATE "C". Recipe ingredient conversion identity.';

comment on column public.recipe_ingredients.canonical_unit is
  'Canonical dimension for recipe ingredient quantities. Allowed values: g, ml, each under COLLATE "C".';

alter table public.modifier_recipe_adjustments
  drop constraint if exists modifier_recipe_adjustments_canonical_unit_check;

alter table public.modifier_recipe_adjustments
  add constraint modifier_recipe_adjustments_canonical_unit_check
  check (
    canonical_unit in ('g', 'ml', 'each')
    and canonical_unit collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint modifier_recipe_adjustments_canonical_unit_check
  on public.modifier_recipe_adjustments is
  'MISE-005CE: exact g/ml/each allowlist plus ASCII shape under COLLATE "C". Modifier adjustment conversion identity.';

comment on column public.modifier_recipe_adjustments.canonical_unit is
  'Canonical dimension for modifier recipe quantity deltas. Allowed values: g, ml, each under COLLATE "C".';

alter table public.ingredient_substitutions
  drop constraint if exists ingredient_substitutions_canonical_unit_check;

alter table public.ingredient_substitutions
  add constraint ingredient_substitutions_canonical_unit_check
  check (
    canonical_unit in ('g', 'ml', 'each')
    and canonical_unit collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint ingredient_substitutions_canonical_unit_check
  on public.ingredient_substitutions is
  'MISE-005CE: exact g/ml/each allowlist plus ASCII shape under COLLATE "C". Substitution conversion identity.';

comment on column public.ingredient_substitutions.canonical_unit is
  'Canonical dimension for ingredient substitution quantities. Allowed values: g, ml, each under COLLATE "C".';

alter table public.supplier_items
  drop constraint if exists supplier_items_canonical_unit_check;

alter table public.supplier_items
  add constraint supplier_items_canonical_unit_check
  check (
    canonical_unit is null
    or (
      canonical_unit in ('g', 'ml', 'each')
      and canonical_unit collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
    )
  );

comment on constraint supplier_items_canonical_unit_check
  on public.supplier_items is
  'MISE-005CE: exact g/ml/each allowlist plus ASCII shape under COLLATE "C". Null remains legal for unverified draft supplier packs.';

comment on column public.supplier_items.canonical_unit is
  'Canonical dimension for supplier pack mapping. Allowed values: g, ml, each under COLLATE "C". Null while draft.';

alter table public.supplier_delivery_items
  drop constraint if exists supplier_delivery_items_canonical_unit_check;

alter table public.supplier_delivery_items
  add constraint supplier_delivery_items_canonical_unit_check
  check (
    canonical_unit in ('g', 'ml', 'each')
    and canonical_unit collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint supplier_delivery_items_canonical_unit_check
  on public.supplier_delivery_items is
  'MISE-005CE: exact g/ml/each allowlist plus ASCII shape under COLLATE "C". Delivery line conversion identity.';

comment on column public.supplier_delivery_items.canonical_unit is
  'Canonical dimension for supplier delivery line quantities. Allowed values: g, ml, each under COLLATE "C".';
