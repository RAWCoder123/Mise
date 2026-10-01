-- MISE-005EN: pin public.inventory_count_sessions.note and
-- public.inventory_count_lines.note CHECKs to reject control characters
-- under COLLATE "C".
--
-- Both note columns only enforced `note is null or char_length(note) <= 240`.
-- They had no control-character gate. Bare POSIX [[:cntrl:]] follows
-- database LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- Count session and line notes are durable free-form operator text on the
-- inventory count ledger. If LC_CTYPE drifted under a bare (or missing)
-- cntrl gate, dump/restore could accept note bytes a restored C-locale
-- path would refuse — or the reverse — breaking count-evidence continuity
-- across restore.
--
-- Scope:
--   - Reattach both note CHECKs preserving the exact char_length bound PLUS
--     ASCII control rejection under COLLATE "C"
-- Does NOT rewrite count-session RPCs, status vocabulary (#495), item_name /
-- unit bounds, discrepancy_reason, supplier_deliveries.notes, or
-- supplier_orders.operator_note (#551).
-- Timestamp after MISE-005EM (#551).

alter table public.inventory_count_sessions
  drop constraint if exists inventory_count_sessions_note_check;

alter table public.inventory_count_sessions
  add constraint inventory_count_sessions_note_check check (
    note is null
    or (
      char_length(note) <= 240
      and note collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint inventory_count_sessions_note_check on public.inventory_count_sessions is
  'MISE-005EN: inventory count session note char_length <= 240 plus ASCII control rejection under COLLATE "C".';

alter table public.inventory_count_lines
  drop constraint if exists inventory_count_lines_note_check;

alter table public.inventory_count_lines
  add constraint inventory_count_lines_note_check check (
    note is null
    or (
      char_length(note) <= 240
      and note collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint inventory_count_lines_note_check on public.inventory_count_lines is
  'MISE-005EN: inventory count line note char_length <= 240 plus ASCII control rejection under COLLATE "C".';
