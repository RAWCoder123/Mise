-- MISE-005HE: pin public.operational_finding_decisions.edited_recommended_action
-- CHECK to reject control characters under COLLATE "C".
--
-- operational_finding_decisions.edited_recommended_action was declared as
-- nullable text with no dedicated column CHECK. Presence and length(trim)
-- 1..320 when decision_type = 'edited' lived only inside
-- operational_finding_decision_edit_check (via
-- length(trim(coalesce(edited_recommended_action, ''))) between 1 and 320).
-- Writers already normalize via nullif(trim(p_edited_recommended_action), '')
-- in record_operational_finding_decision and requireBoundedText(..., 320) in
-- the TypeScript domain layer. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- edited_recommended_action is a durable nullable single-line edited
-- recommended-action snapshot on the append-only finding-decision ledger.
-- It is null for approved/dismissed decisions and, when present, must not
-- accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or missing) cntrl
-- gate, dump/restore could accept action bytes a restored C-locale path
-- would refuse — or the reverse — breaking finding-decision evidence
-- continuity across restore.
--
-- Scope:
--   - Attach operational_finding_decisions_edited_recommended_action_check
--     as null OR length(trim(edited_recommended_action)) between 1 and 320
--     PLUS ASCII control rejection under COLLATE "C".
--   - Dedicated CHECK so this tip stays alone-OK versus
--     operational_finding_decision_edit_check (protect drop with
--     not ilike '%decision_type%' / '%original_recommended_action%'),
--     original_recommended_action (#620), finding_id, policy_version,
--     decision_type (#537), finding_category, severity, evidence,
--     client_event_id, and idempotency_key bounds.
-- Does NOT rewrite record_operational_finding_decision, the edit-shape CHECK
-- semantics, original_recommended_action (#620), evidence hardening, or
-- finding_id / decision_type allowlists.
-- Timestamp after MISE-005HD (#620).

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
        con.conname = 'operational_finding_decisions_edited_recommended_action_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%edited_recommended_action%'
          and (
            pg_get_constraintdef(con.oid)
              ilike '%length%trim%edited_recommended_action%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%decision_type%'
          and pg_get_constraintdef(con.oid) not ilike '%original_recommended_action%'
          and pg_get_constraintdef(con.oid) not ilike '%finding_id%'
          and pg_get_constraintdef(con.oid) not ilike '%policy_version%'
          and pg_get_constraintdef(con.oid) not ilike '%finding_category%'
          and pg_get_constraintdef(con.oid) not ilike '%severity%'
          and pg_get_constraintdef(con.oid) not ilike '%evidence%'
          and pg_get_constraintdef(con.oid) not ilike '%client_event_id%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%confidence_score%'
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
  drop constraint if exists
    operational_finding_decisions_edited_recommended_action_check;

alter table public.operational_finding_decisions
  add constraint operational_finding_decisions_edited_recommended_action_check
  check (
    edited_recommended_action is null
    or (
      length(trim(edited_recommended_action)) between 1 and 320
      and edited_recommended_action collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint
  operational_finding_decisions_edited_recommended_action_check
  on public.operational_finding_decisions is
  'MISE-005HE: operational_finding_decisions edited_recommended_action null or length(trim) 1..320 plus ASCII control rejection under COLLATE "C".';
