-- MISE-005AO: pin public.mise_actions.error_code shape CHECK to COLLATE "C".
--
-- public.mise_actions.error_code is unconstrained text on main. Failure writers
-- (private.service_record_mise_action_failure) still gate with bare:
--   p_error_code !~ '^[a-z0-9_]{1,80}$'
-- MISE-005AG (#441) pins that writer gate with COLLATE "C", and MISE-005AE
-- (#439) pins the sibling private.gmail_safe_error_code helper — but left the
-- durable mise_actions column without a matching table CHECK.
--
-- error_code is durable supplier-send / automation failure evidence. Accepted
-- values are ASCII snake_case tokens compared for exact-retry continuity and
-- restored across dump/restore. Successful actions keep null. POSIX [a-z0-9_]
-- follows database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A
-- proved locale drift on this cluster. Under a bare writer-only gate, dump/
-- restore can accept an error_code the restored C-locale writer would refuse
-- (or the reverse), breaking failure-evidence continuity for mise_actions.
--
-- Scope:
--   - Attach named nullable-or-shape CHECK:
--     error_code is null or error_code collate "C" ~ '^[a-z0-9_]{1,80}$'
-- Does NOT rewrite private.service_record_mise_action_failure (open #441),
-- private.gmail_safe_error_code (open #439), finding policy_version / finding_id
-- (#440 / #442), or reason_code table CHECKs (#448).
-- Timestamp after MISE-005AN (#448).

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
        con.conname = 'mise_actions_error_code_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%error_code%'
          and pg_get_constraintdef(con.oid) ilike '%^[a-z0-9_]{1,80}$%'
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
  drop constraint if exists mise_actions_error_code_check;

alter table public.mise_actions
  add constraint mise_actions_error_code_check check (
    error_code is null
    or error_code collate "C" ~ '^[a-z0-9_]{1,80}$'
  );

comment on constraint mise_actions_error_code_check
  on public.mise_actions is
  'MISE-005AO: nullable mise_actions.error_code ASCII snake_case under COLLATE "C".';
