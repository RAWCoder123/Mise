-- MISE-005EP: pin public.restaurant_tasks.detail to reject unsafe control
-- characters under COLLATE "C", while allowing multiline task bodies.
--
-- restaurant_tasks_detail_check only enforced
--   detail is null or length(trim(detail)) between 1 and 2000
-- It had no control-character gate. Bare POSIX [[:cntrl:]] would also
-- reject LF (and the create-task multiline body field), so this tip uses
-- the same byte class as services/miseValidation.ts
-- `unsafeSupplierSendMultilineControlPattern` / MISE-005EM operator_note:
--   reject U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F
--   allow LF (U+000A), and also TAB (U+0009) / CR (U+000D) for parity
--   with the established multiline control pattern.
--
-- Task detail is durable free-form operator text on the shared restaurant
-- task ledger (create-task body is multiline). If LC_CTYPE drifted under a
-- bare (or missing) cntrl gate, dump/restore could accept detail bytes a
-- restored C-locale path would refuse — or the reverse — breaking
-- task-evidence continuity across restore.
--
-- Scope:
--   - Reattach restaurant_tasks_detail_check preserving the exact
--     length(trim(detail)) between 1 and 2000 bound PLUS multiline-aware
--     ASCII control rejection under COLLATE "C"
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
      and detail collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
    )
  );

comment on constraint restaurant_tasks_detail_check on public.restaurant_tasks is
  'MISE-005EP: restaurant task detail length(trim) 1..2000 plus multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';
