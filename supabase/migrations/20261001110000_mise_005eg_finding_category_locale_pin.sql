-- MISE-005EG: pin public.operational_finding_decisions.finding_category CHECK
-- to COLLATE "C", preserving the exact-token allowlist.
--
-- public.operational_finding_decisions stores finding-category vocabulary
-- under a bare IN allowlist from append_operational_finding_decisions:
--   finding_category in (
--     'inventory', 'ordering', 'sales', 'waste',
--     'prep', 'cost', 'data_quality'
--   )
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'inventory'    — inventory health / count / stock signals
--   'ordering'     — purchasing / reorder / supplier signals
--   'sales'        — sales pattern / demand signals
--   'waste'        — waste / spoilage signals
--   'prep'         — prep / production signals
--   'cost'         — cost / margin signals
--   'data_quality' — mapping / sync / data integrity signals
--
-- finding_category is durable append-only evidence on every recorded finding
-- decision. POSIX character classes follow database LC_CTYPE. This cluster
-- runs libc en_US.UTF-8. MISE-005A proved locale drift on this cluster; open
-- tip #537 pins decision_type on the same table but left finding_category on
-- bare IN. Open tips #440/#442/#454 pin finding_id / policy_version /
-- client_event_id / idempotency_key identity shapes.
--
-- If LC_CTYPE drifted under a bare-IN finding_category CHECK, dump/restore
-- could accept finding-category vocabulary bytes the restored C-locale path
-- (and sibling finding identity gates) would refuse — or the reverse —
-- breaking finding-decision evidence continuity across restore.
--
-- Scope:
--   - Replace operational_finding_decisions_finding_category_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite public.record_operational_finding_decision,
-- operational_finding_decision_edit_check, decision_type (#537),
-- finding_id (#442), policy_version (#440), client_event_id /
-- idempotency_key (#454), severity, or purchase_decision_events.
-- Timestamp after MISE-005EF (#544).

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
        con.conname = 'operational_finding_decisions_finding_category_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%finding_category%'
          and pg_get_constraintdef(con.oid) ilike '%inventory%'
          and pg_get_constraintdef(con.oid) ilike '%ordering%'
          and pg_get_constraintdef(con.oid) ilike '%data_quality%'
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
  drop constraint if exists operational_finding_decisions_finding_category_check;

alter table public.operational_finding_decisions
  add constraint operational_finding_decisions_finding_category_check
  check (
    finding_category in (
      'inventory',
      'ordering',
      'sales',
      'waste',
      'prep',
      'cost',
      'data_quality'
    )
    and finding_category collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint operational_finding_decisions_finding_category_check
  on public.operational_finding_decisions is
  'MISE-005EG: exact inventory/ordering/sales/waste/prep/cost/data_quality allowlist plus ASCII shape under COLLATE "C". Operational finding category vocabulary.';

comment on column public.operational_finding_decisions.finding_category is
  'Operational finding category. Allowed values: inventory, ordering, sales, waste, prep, cost, data_quality under COLLATE "C".';
