-- MISE-005EA: pin public.purchase_decision_events.recommendation_source
-- CHECK to COLLATE "C", preserving the exact-token allowlist.
--
-- Purchase decision memory stores recommendation_source under a bare IN
-- allowlist from MISE-004A:
--   recommendation_source in ('mise_rules', 'legacy_client')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'mise_rules'    — system-generated purchase recommendation evidence
--   'legacy_client' — legacy client-path recommendation evidence
--
-- recommendation_source partitions pattern grouping and eligibility on
-- public.purchase_decision_events. POSIX character classes follow database
-- LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved locale
-- drift on this cluster; open tip #538 pins actor_role / decision_type on
-- the same table but left recommendation_source on bare IN. Open tips
-- #451/#482 pin source_event_key / evidence_version; #490/#491 pin
-- canonical_unit.
--
-- If LC_CTYPE drifted under a bare-IN purchase-decision vocabulary CHECK,
-- dump/restore could accept recommendation_source bytes the restored
-- C-locale path (and sibling purchase-decision gates) would refuse — or
-- the reverse — breaking purchase-decision pattern continuity across
-- restore.
--
-- Scope:
--   - Replace purchase_decision_events_recommendation_source_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite record_purchase_decision_* writers,
-- purchase_decision_actor_role, purchase_decision_events_shape_check,
-- actor_role/decision_type (#538), source_event_key (#451),
-- evidence_version (#482), canonical_unit (#490/#491), or
-- purchase_recommendations.generation_source (#484).
-- Timestamp after MISE-005DZ (#538).

alter table public.purchase_decision_events
  drop constraint if exists purchase_decision_events_recommendation_source_check;

alter table public.purchase_decision_events
  add constraint purchase_decision_events_recommendation_source_check
  check (
    recommendation_source in ('mise_rules', 'legacy_client')
    and recommendation_source collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint purchase_decision_events_recommendation_source_check
  on public.purchase_decision_events is
  'MISE-005EA: exact mise_rules/legacy_client allowlist plus ASCII shape under COLLATE "C". Purchase decision recommendation source vocabulary.';

comment on column public.purchase_decision_events.recommendation_source is
  'Purchase decision recommendation source. Allowed values: mise_rules, legacy_client under COLLATE "C".';
