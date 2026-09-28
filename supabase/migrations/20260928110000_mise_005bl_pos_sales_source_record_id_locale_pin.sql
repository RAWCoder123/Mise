-- MISE-005BL: pin public.pos_sales.source_record_id cntrl CHECK to COLLATE "C".
--
-- public.pos_sales still stores source_record_id under a length-only CHECK from
-- the atomic setup / operational signals migration:
--   source_record_id is null
--   or length(trim(source_record_id)) between 1 and 200
-- with no control-character rejection. MISE-005U (#429) pins the
-- private.prepare_square_sales_for_authority preflight to
--   sale_source_record_id collate "C" ~ '[[:cntrl:]]'
-- but intentionally does not reattach this table CHECK. MISE-005I (#417) pinned
-- the sibling provider_catalog_item_id / provider_location_id /
-- provider_variation_id CHECKs with COLLATE "C" cntrl rejection;
-- source_record_id remained length-only.
--
-- source_record_id is the durable POS provider sale identity (Square order /
-- payment line id) used by UNIQUE (restaurant_id, source_pos, source_record_id)
-- for sale replay / upsert. Authenticated clients hold SELECT only; inserts
-- come from SECURITY DEFINER Square sync / setup paths that trim and left()
-- the id. POSIX character classes follow database LC_CTYPE. This cluster runs
-- libc en_US.UTF-8. MISE-005A proved locale drift on this cluster.
--
-- If LC_CTYPE drifted under a length-only CHECK (or if prepare already rejects
-- controls while the CHECK still admits them), dump/restore and prepare→store
-- continuity can disagree on the same sale identity bytes — accepting a row
-- the restored C-locale gate would refuse (or the reverse), breaking POS sale
-- replay / recipe depletion continuity across restore.
--
-- Scope:
--   - Reattach pos_sales_source_record_id_check preserving the nullable
--     length(trim(...)) 1–200 bound and pinning
--     source_record_id collate "C" !~ '[[:cntrl:]]'
-- Does NOT rewrite private.prepare_square_sales_for_authority (owned by open
-- MISE-005U #429), pos_sales provider-identity CHECKs (MISE-005I #417),
-- selected_modifier_ids (#344), inventory_events identity (#375), or
-- activity_events / restaurant_memories.
-- Timestamp after MISE-005BK (#471 outreach idempotency_key).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.pos_sales'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'pos_sales_source_record_id_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%source_record_id%'
          and pg_get_constraintdef(con.oid) ilike '%length%source_record_id%'
          and pg_get_constraintdef(con.oid) not ilike '%provider_%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.pos_sales drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.pos_sales
  drop constraint if exists pos_sales_source_record_id_check;

alter table public.pos_sales
  add constraint pos_sales_source_record_id_check check (
    source_record_id is null
    or (
      length(trim(source_record_id)) between 1 and 200
      and source_record_id collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint pos_sales_source_record_id_check
  on public.pos_sales is
  'MISE-005BL: optional source_record_id length(trim) 1–200 with ASCII C [[:cntrl:]] rejection (COLLATE "C").';
