-- MISE-005HD: pin public.operational_finding_decisions.original_recommended_action
-- CHECK to reject control characters under COLLATE "C".
--
-- operational_finding_decisions.original_recommended_action was declared as
-- NOT NULL text with length(trim) between 1 and 320 and no control-character
-- gate. Writers already normalize via trim(p_original_recommended_action) in
-- record_operational_finding_decision and requireBoundedText(..., 320) in the
-- TypeScript domain layer. Bare POSIX [[:cntrl:]] follows database LC_CTYPE;
-- this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; sibling tips re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- original_recommended_action is a durable NOT NULL single-line recommended-
-- action snapshot captured with each manager finding decision. It is not
-- free-form multiline prose and must not accept LF/TAB/CR/NUL. If LC_CTYPE
-- drifted under a bare length-only gate, dump/restore could accept action
-- bytes a restored C-locale path would refuse — or the reverse — breaking
-- finding-decision evidence continuity across restore.
--
-- Scope:
--   - Reattach operational_finding_decisions_original_recommended_action_check
--     as length(trim(original_recommended_action)) between 1 and 320 PLUS
--     ASCII control rejection under COLLATE "C". Column is NOT NULL; no null
--     OR branch.
--   - Dedicated CHECK so this tip stays alone-OK versus
--     operational_finding_decision_edit_check (protect drop with
--     not ilike '%decision_type%' / '%edited_recommended_action%'),
--     finding_id, policy_version, decision_type (#537), finding_category,
--     severity, evidence, client_event_id, and idempotency_key bounds.
-- Does NOT rewrite record_operational_finding_decision, the edit-shape CHECK
-- semantics, edited_recommended_action (next Alone-OK tip), evidence
-- hardening, or finding_id / decision_type allowlists.
-- Timestamp after MISE-005HC (#619).

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
        con.conname = 'operational_finding_decisions_original_recommended_action_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%original_recommended_action%'
          and (
            pg_get_constraintdef(con.oid)
              ilike '%length%trim%original_recommended_action%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%edited_recommended_action%'
          and pg_get_constraintdef(con.oid) not ilike '%decision_type%'
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
    operational_finding_decisions_original_recommended_action_check;

alter table public.operational_finding_decisions
  add constraint operational_finding_decisions_original_recommended_action_check
  check (
    length(trim(original_recommended_action)) between 1 and 320
    and original_recommended_action collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint
  operational_finding_decisions_original_recommended_action_check
  on public.operational_finding_decisions is
  'MISE-005HD: operational_finding_decisions original_recommended_action length(trim) 1..320 plus ASCII control rejection under COLLATE "C".';
