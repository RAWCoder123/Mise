-- MISE-005GC: pin public.inventory_count_lines.unit CHECK to reject
-- control characters under COLLATE "C".
--
-- inventory_count_lines.unit was declared as
--   text not null check (char_length(btrim(unit)) between 1 and 40)
-- (inventory_count_sessions_ledger). It had no control-character gate.
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs
-- libc en_US.UTF-8. MISE-005A proved locale drift on this cluster;
-- sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- unit is a durable single-line inventory count snapshot unit label
-- (copied from inventory_items.unit when a count session is opened).
-- It is not free-form multiline prose and must not accept LF/TAB/CR/NUL.
-- If LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore
-- could accept unit bytes a restored C-locale path would refuse —
-- or the reverse — breaking count-line continuity across restore.
--
-- Scope:
--   - Reattach inventory_count_lines_unit_check preserving the exact
--     char_length(btrim(unit)) 1..40 bound PLUS ASCII control
--     rejection under COLLATE "C"
-- Does NOT rewrite count-session RPCs, tip item_name (#592), note (#552),
-- inventory_items tips (#585–#587), pos_sales.item_name (#591), or
-- purchase_recommendations tips (#588–#590). Timestamp after MISE-005GB
-- (#592). Alone-OK vs those stacks.

alter table public.inventory_count_lines
  drop constraint if exists inventory_count_lines_unit_check;

alter table public.inventory_count_lines
  add constraint inventory_count_lines_unit_check check (
    char_length(btrim(unit)) between 1 and 40
    and unit collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint inventory_count_lines_unit_check on public.inventory_count_lines is
  'MISE-005GC: inventory count line unit char_length(btrim) 1..40 plus ASCII control rejection under COLLATE "C".';
