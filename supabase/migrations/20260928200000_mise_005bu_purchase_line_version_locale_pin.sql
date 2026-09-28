-- MISE-005BU: pin public.purchase_lines normalization_version and
-- evidence_version shape CHECKs to COLLATE "C" via additive dedicated
-- CHECKs.
--
-- public.purchase_lines stores MISE-004C contract versions under bare
-- equality allowlists created with the ledger table:
--   normalization_version = 'mise.purchase_line_normalization.v1'
--   evidence_version = 'mise.purchase_line.v1'
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Both columns are NOT NULL with those
-- defaults.
--
-- Writers mint the durable ASCII version tokens:
--   'mise.purchase_line_normalization.v1'
--   'mise.purchase_line.v1'
-- (private.append_purchase_line / public.ingest_purchase_lines from
-- MISE-004C, mirrored by services/domain/purchaseLines.ts). Without a
-- dedicated COLLATE "C" shape CHECK, dump/restore under LC_CTYPE drift can
-- accept version bytes the restored C-locale path (and sibling
-- machine-identity gates) would refuse — or the reverse — breaking
-- purchase-line ledger contract continuity across restore.
--
-- Open MISE-005AL (#446) pins currency and MISE-005BQ (#477) pins
-- normalized_item_key cntrl on this table; neither rewrites the version
-- allowlists. Additive dedicated CHECKs pin the ASCII shape under
-- COLLATE "C" without dropping or replacing the original equality
-- constraints, and without colliding with those stacks.
--
-- Scope:
--   - Add NOT NULL shape CHECKs for normalization_version and
--     evidence_version with `collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'`
-- Does NOT rewrite purchase_lines currency (#446), normalized_item_key
-- (#477), ingest/supersede RPCs, purchase_decision_events.evidence_version,
-- or free-form raw_item_description / source_document_reference.
-- Timestamp after MISE-005BT (#480).

alter table public.purchase_lines
  drop constraint if exists purchase_lines_normalization_version_check;

alter table public.purchase_lines
  add constraint purchase_lines_normalization_version_check check (
    normalization_version collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint purchase_lines_normalization_version_check
  on public.purchase_lines is
  'MISE-005BU: ASCII purchase_lines.normalization_version under COLLATE "C".';

alter table public.purchase_lines
  drop constraint if exists purchase_lines_evidence_version_check;

alter table public.purchase_lines
  add constraint purchase_lines_evidence_version_check check (
    evidence_version collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint purchase_lines_evidence_version_check
  on public.purchase_lines is
  'MISE-005BU: ASCII purchase_lines.evidence_version under COLLATE "C".';
