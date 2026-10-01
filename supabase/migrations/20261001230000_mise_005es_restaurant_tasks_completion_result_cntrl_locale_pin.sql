-- MISE-005ES: pin public.restaurant_tasks.completion_result to reject unsafe
-- control characters under COLLATE "C", while allowing multiline results.
--
-- restaurant_tasks_completion_check only enforced
--   length(trim(completion_result)) between 1 and 1000
-- when status = 'completed'. It had no control-character gate, and there was
-- no dedicated completion_result bound CHECK. Bare POSIX [[:cntrl:]] would
-- also reject LF (and the task-detail completion TextInput is multiline), so
-- this tip uses the same byte class as services/miseValidation.ts
-- `unsafeSupplierSendMultilineControlPattern` / MISE-005EM operator_note /
-- MISE-005EP restaurant_tasks.detail:
--   reject U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F
--   allow LF (U+000A), and also TAB (U+0009) / CR (U+000D) for parity
--   with the established multiline control pattern.
--
-- Completion results are durable free-form operator text on the shared
-- restaurant task ledger (complete-task result field is multiline). If
-- LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore could
-- accept completion_result bytes a restored C-locale path would refuse — or
-- the reverse — breaking task-evidence continuity across restore.
--
-- Scope:
--   - Add restaurant_tasks_completion_result_bound_check preserving the exact
--     length(trim(completion_result)) between 1 and 1000 bound PLUS
--     multiline-aware ASCII control rejection under COLLATE "C"
--   - Does NOT rewrite restaurant_tasks_completion_check status machine,
--     create/complete/cancel task RPCs, title (#556), detail (#554),
--     recalculation_runs.failure_reason (#555), supplier delivery notes
--     (#553), inventory count notes (#552), supplier_orders.operator_note
--     (#551), or client_task_id (#455).
-- Timestamp after MISE-005ER (#556).

alter table public.restaurant_tasks
  drop constraint if exists restaurant_tasks_completion_result_bound_check;

alter table public.restaurant_tasks
  add constraint restaurant_tasks_completion_result_bound_check check (
    completion_result is null
    or (
      length(trim(completion_result)) between 1 and 1000
      and completion_result collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
    )
  );

comment on constraint restaurant_tasks_completion_result_bound_check on public.restaurant_tasks is
  'MISE-005ES: restaurant task completion_result length(trim) 1..1000 plus multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';
