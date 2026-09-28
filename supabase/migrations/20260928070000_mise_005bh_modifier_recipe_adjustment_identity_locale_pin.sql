-- MISE-005BH: pin public.modifier_recipe_adjustments.external_modifier_id
-- CHECK to COLLATE "C".
--
-- public.modifier_recipe_adjustments.external_modifier_id is still unbound
-- text (NOT NULL). Open manager-authority writers (#341) reject empty and
-- length > 128 after trim, but never reject control characters. Open #344
-- already bounds sale-side selected_modifier_ids with length + cntrl (without
-- COLLATE "C"), so adjustment rows and sale selected ids can disagree under
-- dump/restore if LC_CTYPE drifts.
--
-- external_modifier_id is the durable Square (and future POS) catalog
-- modifier join key used for verified recipe-delta lookup and (after #344)
-- sale→modifier→inventory depletion. Demo / planned fixtures use printable
-- ASCII tokens. Client SELECT-only grants leave writes to SECURITY DEFINER
-- RPCs and service_role.
--
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; later 005* tips pinned catalog mapping identity (#467) and
-- sale/location provider ids, but left modifier_recipe_adjustments with no
-- shape CHECK because open #341/#342/#344 own the upsert and depletion writers.
--
-- If LC_CTYPE drifted with no shape CHECK, dump/restore could accept a
-- modifier identity the restored C-locale sale selected_modifier_ids gate
-- would refuse (or the reverse), breaking sale→modifier→recipe depletion
-- joins across restore.
--
-- Scope:
--   - Add named length + cntrl CHECK under COLLATE "C" for
--     external_modifier_id (length 1–128; empty rejected).
--   - Does NOT rewrite upsert/verify/reject/expire RPCs (#341), Square
--     modifier sync metadata (#342), selected_modifier_ids / depletion (#344),
--     modifier_name free-form display, or activity_events /
--     restaurant_memories / inventory_events.
-- Timestamp after MISE-005BG (#467 pos_catalog_item_mappings identity).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.modifier_recipe_adjustments'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'modifier_recipe_adjustments_external_modifier_id_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%external_modifier_id%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(external_modifier_id)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.modifier_recipe_adjustments drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.modifier_recipe_adjustments
  drop constraint if exists modifier_recipe_adjustments_external_modifier_id_check;

alter table public.modifier_recipe_adjustments
  add constraint modifier_recipe_adjustments_external_modifier_id_check
    check (
      length(external_modifier_id) between 1 and 128
      and external_modifier_id collate "C" !~ '[[:cntrl:]]'
    );

comment on constraint modifier_recipe_adjustments_external_modifier_id_check
  on public.modifier_recipe_adjustments is
  'MISE-005BH: external_modifier_id length 1–128 and ASCII C [[:cntrl:]] rejection (COLLATE "C"); sale-side join parity with pos_sales.selected_modifier_ids (#344).';
