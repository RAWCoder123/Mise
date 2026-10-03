-- MISE-005GL: pin public.modifier_recipe_adjustments.modifier_name CHECK to
-- reject control characters under COLLATE "C" and lock the POS modifier
-- display-name length bound.
--
-- modifier_recipe_adjustments.modifier_name is durable NOT NULL text
-- (operational_data_foundation_inventory_ledger) with no table-level length
-- or control-character gate. Open manager-authority writers (#341) reject
-- empty names and refuse char_length > 160 after btrim
-- (MAX_MODIFIER_NAME_LENGTH = 160) before insert/update, but never reject
-- control characters and do not yet land a table CHECK. Bare POSIX
-- [[:cntrl:]] follows database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling tips
-- re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- modifier_name is a durable single-line POS modifier label (operator-facing
-- catalog modifier display name mirrored onto verified recipe deltas). It is
-- not free-form multiline prose and must not accept LF/TAB/CR/NUL. If
-- LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore could
-- accept modifier_name bytes a restored C-locale path would refuse — or the
-- reverse — breaking modifier adjustment readability and operator review
-- continuity across restore.
--
-- Scope:
--   - Attach modifier_recipe_adjustments_modifier_name_check as
--     length(trim(modifier_name)) between 1 and 160 PLUS ASCII control
--     rejection under COLLATE "C" (matches open #341 writer bound)
--   - Dedicated CHECK so this tip stays alone-OK versus
--     modifier_recipe_adjustments_external_modifier_id_check (#468),
--     verification_status (#493), and canonical_unit (#491)
-- Does NOT rewrite upsert/verify/reject/expire RPCs (#341), Square modifier
-- sync metadata (#342), selected_modifier_ids / depletion (#344), or
-- external_modifier_id / verification_status / canonical_unit bounds.
-- Timestamp after MISE-005GK (#601).

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
        con.conname = 'modifier_recipe_adjustments_modifier_name_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\ymodifier_name\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%modifier_name%'
            or pg_get_constraintdef(con.oid) ilike '%length(modifier_name)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%external_modifier_id%'
          and pg_get_constraintdef(con.oid) not ilike '%verification_status%'
          and pg_get_constraintdef(con.oid) not ilike '%canonical_unit%'
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
  drop constraint if exists modifier_recipe_adjustments_modifier_name_check;

alter table public.modifier_recipe_adjustments
  add constraint modifier_recipe_adjustments_modifier_name_check check (
    length(trim(modifier_name)) between 1 and 160
    and modifier_name collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint modifier_recipe_adjustments_modifier_name_check
  on public.modifier_recipe_adjustments is
  'MISE-005GL: modifier_recipe_adjustments modifier_name length(trim) 1..160 plus ASCII control rejection under COLLATE "C".';
