-- MISE-005AN: pin operational-mode and pilot-control reason_code CHECKs to
-- COLLATE "C".
--
-- private.operational_mode_changes and private.pilot_operational_control_changes
-- still store reason_code under bare class matches:
--   reason_code ~ '^[a-z0-9_]{3,64}$'
-- (inline column CHECKs from emergency operational mode + MISE-PILOT-001).
-- MISE-005Z (#434) pins the service_set_system_operational_mode writer gate,
-- and MISE-005Y (#433) pins the service_apply_pilot_operational_control
-- lower/shape gate — both with COLLATE "C" — but left the durable table
-- CHECKs on bare POSIX classes.
--
-- reason_code is durable kill-switch / emergency-mode evidence. Accepted
-- values are ASCII snake_case tokens compared for exact-retry conflicts and
-- restored across dump/restore. POSIX [a-z0-9_] follows database LC_CTYPE.
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster. Under bare class checks, dump/restore can accept a reason_code
-- the restored C-locale writer gate would refuse (or the reverse), breaking
-- replay/idempotency continuity for pilot and operational-mode history.
--
-- Scope:
--   - Reattach named reason_code CHECKs on both evidence tables with
--     `reason_code collate "C" ~ '^[a-z0-9_]{3,64}$'`
-- Does NOT rewrite service_set_system_operational_mode (open #434),
-- service_apply_pilot_operational_control (open #433), finding policy_version
-- (#440), finding_id (#442), or mise_action failure error_code (#441).
-- Timestamp after MISE-005AM (#447).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'private.operational_mode_changes'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'operational_mode_changes_reason_code_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%reason_code%'
          and pg_get_constraintdef(con.oid) ilike '%^[a-z0-9_]{3,64}$%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table private.operational_mode_changes drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table private.operational_mode_changes
  drop constraint if exists operational_mode_changes_reason_code_check;

alter table private.operational_mode_changes
  add constraint operational_mode_changes_reason_code_check check (
    reason_code collate "C" ~ '^[a-z0-9_]{3,64}$'
  );

comment on constraint operational_mode_changes_reason_code_check
  on private.operational_mode_changes is
  'MISE-005AN: operational-mode reason_code ASCII snake_case under COLLATE "C".';

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'private.pilot_operational_control_changes'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'pilot_operational_control_changes_reason_code_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%reason_code%'
          and pg_get_constraintdef(con.oid) ilike '%^[a-z0-9_]{3,64}$%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table private.pilot_operational_control_changes drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table private.pilot_operational_control_changes
  drop constraint if exists pilot_operational_control_changes_reason_code_check;

alter table private.pilot_operational_control_changes
  add constraint pilot_operational_control_changes_reason_code_check check (
    reason_code collate "C" ~ '^[a-z0-9_]{3,64}$'
  );

comment on constraint pilot_operational_control_changes_reason_code_check
  on private.pilot_operational_control_changes is
  'MISE-005AN: pilot-control reason_code ASCII snake_case under COLLATE "C".';
