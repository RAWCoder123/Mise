-- MISE-005FO: pin public.mise_actions.reason CHECK to reject unsafe
-- control characters under COLLATE "C", while allowing multiline reasons.
--
-- mise_actions.reason was declared as nullable text with no length or
-- control-character gate. Current writers mint operator-facing sentences via
--   format('Send the prepared %s supplier order after owner or manager
--          approval.', supplier_name)
-- where supplier display names are bounded to 160 characters, so live rows
-- stay well under 1000. Bare POSIX [[:cntrl:]] would also reject LF (and the
-- established supplier-send / operator-note multiline allowlist), so this tip
-- uses the same byte class as services/miseValidation.ts
-- `unsafeSupplierSendMultilineControlPattern`:
--   reject U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F
--   allow LF (U+000A), and also TAB (U+0009) / CR (U+000D) for parity
--   with the established multiline control pattern.
--
-- Reason is durable operator-facing action prose on the mise_actions ledger.
-- It is free-form-ish sentence text (supplier name interpolated), not a
-- single-line system key. If LC_CTYPE drifted under a bare (or missing)
-- cntrl gate, dump/restore could accept reason bytes a restored C-locale
-- path would refuse — or the reverse — breaking action-ledger continuity
-- across restore.
--
-- Scope:
--   - Add mise_actions_reason_check as null OR
--     length(trim(reason)) between 1 and 1000 PLUS multiline-aware ASCII
--     control rejection under COLLATE "C"
-- Does NOT rewrite mise_actions writers/triggers, rollback_reference (#578),
-- trigger_type (#577), trigger_reference (#576), error_code (#441/#449),
-- error_message, or idempotency_key (#457).
-- Timestamp after MISE-005FN (#578).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.mise_actions'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'mise_actions_reason_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%reason%'
          and pg_get_constraintdef(con.oid) ilike '%length%trim%reason%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_type%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_reference%'
          and pg_get_constraintdef(con.oid) not ilike '%error_code%'
          and pg_get_constraintdef(con.oid) not ilike '%error_message%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%rollback_reference%'
          and pg_get_constraintdef(con.oid) not ilike '%action_type%'
          and pg_get_constraintdef(con.oid) not ilike '%execution_mode%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.mise_actions drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.mise_actions
  drop constraint if exists mise_actions_reason_check;

alter table public.mise_actions
  add constraint mise_actions_reason_check check (
    reason is null
    or (
      length(trim(reason)) between 1 and 1000
      and reason collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
    )
  );

comment on constraint mise_actions_reason_check on public.mise_actions is
  'MISE-005FO: mise action reason null or length(trim) 1..1000 plus multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';
