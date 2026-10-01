-- MISE-005EP: pin public.restaurant_tasks.detail CHECK to reject control
-- characters under COLLATE "C".
--
-- restaurant_tasks_detail_check only enforced
--   detail is null or length(trim(detail)) between 1 and 2000
-- It had no control-character gate. Bare POSIX [[:cntrl:]] follows
-- database LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- Task detail is durable free-form operator text on the shared restaurant
-- task ledger. If LC_CTYPE drifted under a bare (or missing) cntrl gate,
-- dump/restore could accept detail bytes a restored C-locale path would
-- refuse — or the reverse — breaking task-evidence continuity across
-- restore.
--
-- Scope:
--   - Reattach restaurant_tasks_detail_check preserving the exact
--     length(trim(detail)) between 1 and 2000 bound PLUS ASCII control
--     rejection under COLLATE "C"
-- Does NOT rewrite create/complete/cancel task RPCs, title bounds,
-- completion_result, service_window vocabulary (#505), verification_method
-- (#504), supplier delivery notes (#553), inventory count notes (#552),
-- supplier_orders.operator_note (#551), or recalculation_runs.failure_reason.
-- Timestamp after MISE-005EO (#553).

alter table public.restaurant_tasks
  drop constraint if exists restaurant_tasks_detail_check;

alter table public.restaurant_tasks
  add constraint restaurant_tasks_detail_check check (
    detail is null
    or (
      length(trim(detail)) between 1 and 2000
      and detail collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint restaurant_tasks_detail_check on public.restaurant_tasks is
  'MISE-005EP: restaurant task detail length(trim) 1..2000 plus ASCII control rejection under COLLATE "C".';
