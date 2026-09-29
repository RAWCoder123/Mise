-- MISE-005CG: pin verification_status CHECKs to COLLATE "C",
-- preserving the exact-token allowlist on pos_catalog_item_mappings,
-- recipe_ingredients, modifier_recipe_adjustments,
-- ingredient_substitutions, supplier_items, and
-- inventory_items.canonical_unit_verification_status.
--
-- These columns store review-state vocabulary under bare IN allowlists from
-- operational_data_foundation_inventory_ledger and
-- inventory_item_canonical_unit_authority:
--   verification_status in ('draft', 'verified', 'rejected', 'expired')
--   canonical_unit_verification_status in ('draft', 'verified', 'rejected', 'expired')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'draft'     — unverified / provisional mapping or conversion
--   'verified'  — operator-confirmed authority
--   'rejected'  — explicitly refused mapping or conversion
--   'expired'   — formerly verified, no longer current
--
-- verification_status gates POS catalog→menu authority, recipe line trust,
-- modifier adjustment trust, substitution trust, supplier-item pack mapping
-- trust, and inventory canonical-unit conversion authority. POSIX character
-- classes follow database LC_CTYPE. This cluster runs libc en_US.UTF-8.
-- MISE-005A proved locale drift on this cluster; open sibling pins cover
-- mapping identity (#467), modifier external_modifier_id (#468),
-- inventory_items.canonical_unit (#490), sibling canonical_unit (#491), and
-- inventory_events.event_type (#492), but leave these verification_status
-- CHECKs on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN verification_status CHECK, dump/restore
-- could accept review-state bytes the restored C-locale path (and sibling
-- machine-identity gates) would refuse — or the reverse — breaking mapping,
-- recipe, substitution, supplier-pack, and canonical-unit authority continuity
-- across restore.
--
-- Scope:
--   - Replace *_verification_status_check / canonical_unit_verification_status
--     CHECKs with exact-token allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite mapping-review / verify / sync / recipe writers,
-- inventory_items.canonical_unit (#490), sibling canonical_unit (#491),
-- inventory_events.event_type (#492), mapping identity (#467), modifier
-- identity (#468), recipe_versions.status, or free-form notes.
-- Timestamp after MISE-005CF (#492).

alter table public.pos_catalog_item_mappings
  drop constraint if exists pos_catalog_item_mappings_verification_status_check;

alter table public.pos_catalog_item_mappings
  add constraint pos_catalog_item_mappings_verification_status_check
  check (
    verification_status in ('draft', 'verified', 'rejected', 'expired')
    and verification_status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint pos_catalog_item_mappings_verification_status_check
  on public.pos_catalog_item_mappings is
  'MISE-005CG: exact draft/verified/rejected/expired allowlist plus ASCII shape under COLLATE "C". POS catalog mapping review state.';

comment on column public.pos_catalog_item_mappings.verification_status is
  'POS catalog mapping review state. Allowed values: draft, verified, rejected, expired under COLLATE "C".';

alter table public.recipe_ingredients
  drop constraint if exists recipe_ingredients_verification_status_check;

alter table public.recipe_ingredients
  add constraint recipe_ingredients_verification_status_check
  check (
    verification_status in ('draft', 'verified', 'rejected', 'expired')
    and verification_status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint recipe_ingredients_verification_status_check
  on public.recipe_ingredients is
  'MISE-005CG: exact draft/verified/rejected/expired allowlist plus ASCII shape under COLLATE "C". Recipe ingredient review state.';

comment on column public.recipe_ingredients.verification_status is
  'Recipe ingredient review state. Allowed values: draft, verified, rejected, expired under COLLATE "C".';

alter table public.modifier_recipe_adjustments
  drop constraint if exists modifier_recipe_adjustments_verification_status_check;

alter table public.modifier_recipe_adjustments
  add constraint modifier_recipe_adjustments_verification_status_check
  check (
    verification_status in ('draft', 'verified', 'rejected', 'expired')
    and verification_status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint modifier_recipe_adjustments_verification_status_check
  on public.modifier_recipe_adjustments is
  'MISE-005CG: exact draft/verified/rejected/expired allowlist plus ASCII shape under COLLATE "C". Modifier adjustment review state.';

comment on column public.modifier_recipe_adjustments.verification_status is
  'Modifier recipe adjustment review state. Allowed values: draft, verified, rejected, expired under COLLATE "C".';

alter table public.ingredient_substitutions
  drop constraint if exists ingredient_substitutions_verification_status_check;

alter table public.ingredient_substitutions
  add constraint ingredient_substitutions_verification_status_check
  check (
    verification_status in ('draft', 'verified', 'rejected', 'expired')
    and verification_status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint ingredient_substitutions_verification_status_check
  on public.ingredient_substitutions is
  'MISE-005CG: exact draft/verified/rejected/expired allowlist plus ASCII shape under COLLATE "C". Ingredient substitution review state.';

comment on column public.ingredient_substitutions.verification_status is
  'Ingredient substitution review state. Allowed values: draft, verified, rejected, expired under COLLATE "C".';

alter table public.supplier_items
  drop constraint if exists supplier_items_verification_status_check;

alter table public.supplier_items
  add constraint supplier_items_verification_status_check
  check (
    verification_status in ('draft', 'verified', 'rejected', 'expired')
    and verification_status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint supplier_items_verification_status_check
  on public.supplier_items is
  'MISE-005CG: exact draft/verified/rejected/expired allowlist plus ASCII shape under COLLATE "C". Supplier item pack-mapping review state.';

comment on column public.supplier_items.verification_status is
  'Supplier item pack-mapping review state. Allowed values: draft, verified, rejected, expired under COLLATE "C".';

alter table public.inventory_items
  drop constraint if exists inventory_items_canonical_unit_verification_status_check;

alter table public.inventory_items
  add constraint inventory_items_canonical_unit_verification_status_check
  check (
    canonical_unit_verification_status in ('draft', 'verified', 'rejected', 'expired')
    and canonical_unit_verification_status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint inventory_items_canonical_unit_verification_status_check
  on public.inventory_items is
  'MISE-005CG: exact draft/verified/rejected/expired allowlist plus ASCII shape under COLLATE "C". Inventory canonical-unit conversion review state.';

comment on column public.inventory_items.canonical_unit_verification_status is
  'Canonical-unit conversion review state. Allowed values: draft, verified, rejected, expired under COLLATE "C".';
