-- MISE-005BV: pin public.purchase_decision_events.evidence_version shape
-- CHECK to COLLATE "C", preserving the exact-token allowlist.
--
-- public.purchase_decision_events stores the MISE-004A evidence contract
-- under a bare equality allowlist created with the ledger table:
--   evidence_version = 'mise.purchase_decision.v1'
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". The column is NOT NULL with that default.
--
-- Writers mint the durable ASCII version token via the column default
-- (private.record_purchase_decision_base_event /
-- private.record_purchase_decision_compensation omit the column and rely
-- on DEFAULT 'mise.purchase_decision.v1'; mirrored by
-- services/domain/purchaseDecisionMemory.ts as
-- PURCHASE_DECISION_EVIDENCE_VERSION). Without a dedicated COLLATE "C"
-- shape CHECK, dump/restore under LC_CTYPE drift can accept version bytes
-- the restored C-locale path (and sibling machine-identity gates) would
-- refuse — or the reverse — breaking purchase-decision evidence continuity
-- across restore.
--
-- Open MISE-005AQ (#451) pins source_event_key and MISE-005H (#416) pins
-- unit cntrl on this table; neither rewrites evidence_version. Replace the
-- auto-named bare-equality CHECK with equality PLUS ASCII shape under
-- COLLATE "C" so the exact token gate is preserved while the locale pin
-- lands. Do not collide with those stacks.
--
-- Scope:
--   - Replace purchase_decision_events_evidence_version_check with:
--       evidence_version = 'mise.purchase_decision.v1'
--       and evidence_version collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
-- Does NOT rewrite source_event_key (#451), recommendation_unit /
-- canonical_unit cntrl (#416), purchase_lines versions (#481), or
-- record_purchase_decision_* writers.
-- Timestamp after MISE-005BU (#481).

alter table public.purchase_decision_events
  drop constraint if exists purchase_decision_events_evidence_version_check;

alter table public.purchase_decision_events
  add constraint purchase_decision_events_evidence_version_check check (
    evidence_version = 'mise.purchase_decision.v1'
    and evidence_version collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint purchase_decision_events_evidence_version_check
  on public.purchase_decision_events is
  'MISE-005BV: exact mise.purchase_decision.v1 plus ASCII shape under COLLATE "C".';
