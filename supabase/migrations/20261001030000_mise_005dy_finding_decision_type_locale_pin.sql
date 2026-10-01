-- MISE-005DY: pin public.operational_finding_decisions.decision_type CHECK
-- to COLLATE "C", preserving the exact-token allowlist.
--
-- public.operational_finding_decisions stores manager finding-decision
-- vocabulary under a bare IN allowlist from
-- append_operational_finding_decisions:
--   decision_type in ('approved', 'edited', 'dismissed')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'approved'  — operator accepted the recommended action as-is
--   'edited'    — operator accepted with an edited recommended action
--   'dismissed' — operator dismissed the finding without applying
--
-- decision_type is durable append-only evidence on every recorded finding
-- decision and gates the edit-evidence compound CHECK
-- (operational_finding_decision_edit_check). POSIX character classes follow
-- database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; open tip #454 pins client_event_id /
-- idempotency_key identity shapes on the same table but left decision_type
-- on bare IN. Open tips #440/#442 pin policy_version / finding_id.
--
-- If LC_CTYPE drifted under a bare-IN decision_type CHECK, dump/restore
-- could accept finding-decision vocabulary bytes the restored C-locale
-- path (and sibling finding identity gates) would refuse — or the reverse —
-- breaking finding-decision evidence continuity across restore.
--
-- Scope:
--   - Replace operational_finding_decisions_decision_type_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite public.record_operational_finding_decision,
-- operational_finding_decision_edit_check, finding_id (#442),
-- policy_version (#440), client_event_id / idempotency_key (#454),
-- finding_category, severity, or purchase_decision_events.decision_type.
-- Timestamp after MISE-005DX (#536).

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
        con.conname = 'operational_finding_decisions_decision_type_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%decision_type%'
          and pg_get_constraintdef(con.oid) ilike '%approved%'
          and pg_get_constraintdef(con.oid) ilike '%edited%'
          and pg_get_constraintdef(con.oid) ilike '%dismissed%'
          and pg_get_constraintdef(con.oid) not ilike '%edited_recommended_action%'
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
  drop constraint if exists operational_finding_decisions_decision_type_check;

alter table public.operational_finding_decisions
  add constraint operational_finding_decisions_decision_type_check
  check (
    decision_type in (
      'approved',
      'edited',
      'dismissed'
    )
    and decision_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint operational_finding_decisions_decision_type_check
  on public.operational_finding_decisions is
  'MISE-005DY: exact approved/edited/dismissed allowlist plus ASCII shape under COLLATE "C". Operational finding decision vocabulary.';

comment on column public.operational_finding_decisions.decision_type is
  'Operational finding decision type. Allowed values: approved, edited, dismissed under COLLATE "C".';
