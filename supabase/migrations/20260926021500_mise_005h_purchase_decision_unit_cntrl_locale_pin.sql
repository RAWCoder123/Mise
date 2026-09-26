-- MISE-005H: pin purchase_decision_events.recommendation_unit cntrl CHECK to
-- COLLATE "C".
--
-- public.purchase_decision_events is append-only decision evidence (MISE-004A).
-- Its recommendation_unit CHECK still used bare POSIX [[:cntrl:]], which follows
-- database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A already
-- proved locale drift on this cluster for lower() / [[:alnum:]]; MISE-005B and
-- MISE-005F re-pinned suppliers.display_name and purchase_lines text columns
-- with `collate "C" !~ '[[:cntrl:]]'`.
--
-- If a glibc/ICU change reclassified a stored byte under bare [[:cntrl:]],
-- pg_dump/restore would reject rows the source accepted. Those rows cannot be
-- repaired in place without dropping the append-only guarantee.
--
-- Scope:
--   - Reattach purchase_decision_events_recommendation_unit_check with
--     `recommendation_unit collate "C" !~ '[[:cntrl:]]'`
-- Does NOT rewrite approve/dismiss/undo wrappers (compose with open stacks).
-- Restore authority is the CHECK.

alter table public.purchase_decision_events
  drop constraint if exists purchase_decision_events_recommendation_unit_check;

alter table public.purchase_decision_events
  add constraint purchase_decision_events_recommendation_unit_check check (
    length(trim(recommendation_unit)) between 1 and 80
    and recommendation_unit collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint purchase_decision_events_recommendation_unit_check
  on public.purchase_decision_events is
  'MISE-005H: recommendation_unit length 1–80 and ASCII C [[:cntrl:]] rejection (COLLATE "C").';
