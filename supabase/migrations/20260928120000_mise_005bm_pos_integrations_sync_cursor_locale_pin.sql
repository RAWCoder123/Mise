-- MISE-005BM: pin public.pos_integrations.sync_cursor length + cntrl CHECK to
-- COLLATE "C" (NULL allowed).
--
-- public.pos_integrations.sync_cursor is still unbound nullable text (created
-- in restaurant_ops_backbone with no length or charset CHECK). SECURITY DEFINER
-- Square sync writers store it as:
--   nullif(left(coalesce(p_sync_cursor, ''), 500), '')
-- so empty becomes NULL and non-empty values are truncated to 500 characters,
-- with no control-character rejection. Sibling POS identity columns on
-- pos_integrations / pos_sales / pos_locations were pinned under COLLATE "C"
-- by open MISE-005* tips (#417, #460, #465, #466, #472); sync_cursor stayed
-- unbound.
--
-- sync_cursor is the durable provider pagination / incremental-sync token
-- (Square cursor or equivalent) written after a successful sales sync and
-- cleared on disconnect. Authenticated clients hold no direct DML; updates
-- come from SECURITY DEFINER sync paths. Provider cursors are opaque printable
-- tokens, not free-form operator text — they must not carry control bytes that
-- could confuse logs, exports, or restore continuity.
--
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster. POSIX character classes follow database LC_CTYPE.
--
-- If LC_CTYPE drifted with no shape CHECK, dump/restore could accept a sync
-- cursor the restored C-locale gate would refuse (or the reverse), breaking
-- POS incremental sync continuity across restore — the same class of
-- dump/restore disagreement already closed for sale / location identities.
--
-- Scope:
--   - Add named nullable CHECK:
--     sync_cursor is null
--     or (
--       length(sync_cursor) between 1 and 500
--       and sync_cursor collate "C" !~ '[[:cntrl:]]'
--     )
--   - length (not trim) matches writer left(..., 500) + nullif('', '') — no
--     trim() in the sync writers.
-- Does NOT rewrite private.service_apply_square_sync_result /
-- private.service_apply_square_sync_result_scoped / authority sync wrappers
-- (they already truncate via left(..., 500); a follow-up may add COLLATE C
-- cntrl preflight once this CHECK lands). Does NOT rewrite
-- external_location_id (#466), merchant_id (#460), pos_sales identities
-- (#417/#472), selected_modifier_ids (#344), inventory_events (#375), or
-- activity_events / restaurant_memories.
-- Timestamp after MISE-005BL (#472 pos_sales.source_record_id).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.pos_integrations'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'pos_integrations_sync_cursor_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%sync_cursor%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(sync_cursor)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.pos_integrations drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.pos_integrations
  drop constraint if exists pos_integrations_sync_cursor_check;

alter table public.pos_integrations
  add constraint pos_integrations_sync_cursor_check check (
    sync_cursor is null
    or (
      length(sync_cursor) between 1 and 500
      and sync_cursor collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint pos_integrations_sync_cursor_check
  on public.pos_integrations is
  'MISE-005BM: optional sync_cursor length 1–500 with ASCII C [[:cntrl:]] rejection (COLLATE "C").';
