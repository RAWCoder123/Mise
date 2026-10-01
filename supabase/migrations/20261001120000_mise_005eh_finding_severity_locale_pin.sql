-- MISE-005EH: pin public.operational_finding_decisions.severity CHECK
-- to COLLATE "C", preserving the exact-token allowlist.
--
-- public.operational_finding_decisions stores finding-severity vocabulary
-- under a bare IN allowlist from append_operational_finding_decisions:
--   severity in ('info', 'warning', 'urgent')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'info'    — informational finding; no immediate operator action required
--   'warning' — elevated risk; operator should review soon
--   'urgent'  — time-sensitive risk; operator attention is required now
--
-- severity is durable append-only evidence on every recorded finding
-- decision. POSIX character classes follow database LC_CTYPE. This cluster
-- runs libc en_US.UTF-8. MISE-005A proved locale drift on this cluster;
-- open tip #537 pins decision_type and open tip #545 pins finding_category
-- on the same table but left severity on bare IN. Open tips #440/#442/#454
-- pin finding_id / policy_version / client_event_id / idempotency_key
-- identity shapes.
--
-- If LC_CTYPE drifted under a bare-IN severity CHECK, dump/restore could
-- accept finding-severity vocabulary bytes the restored C-locale path
-- (and sibling finding identity gates) would refuse — or the reverse —
-- breaking finding-decision evidence continuity across restore.
--
-- Scope:
--   - Replace operational_finding_decisions_severity_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite public.record_operational_finding_decision,
-- operational_finding_decision_edit_check, decision_type (#537),
-- finding_category (#545), finding_id (#442), policy_version (#440),
-- client_event_id / idempotency_key (#454), insights.severity (#515),
-- operational_issues.severity (#508), or purchase_decision_events.
-- Timestamp after MISE-005EG (#545).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.operational_finding_decisions'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'operational_finding_decisions_severity_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%severity%'
          and pg_get_constraintdef(con.oid) ilike '%info%'
          and pg_get_constraintdef(con.oid) ilike '%warning%'
          and pg_get_constraintdef(con.oid) ilike '%urgent%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.operational_finding_decisions drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.operational_finding_decisions
  drop constraint if exists operational_finding_decisions_severity_check;

alter table public.operational_finding_decisions
  add constraint operational_finding_decisions_severity_check
  check (
    severity in (
      'info',
      'warning',
      'urgent'
    )
    and severity collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint operational_finding_decisions_severity_check
  on public.operational_finding_decisions is
  'MISE-005EH: exact info/warning/urgent allowlist plus ASCII shape under COLLATE "C". Operational finding severity vocabulary.';

comment on column public.operational_finding_decisions.severity is
  'Operational finding severity. Allowed values: info, warning, urgent under COLLATE "C".';
