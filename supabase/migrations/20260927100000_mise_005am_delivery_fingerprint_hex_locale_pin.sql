-- MISE-005AM: pin supplier_email_deliveries content/authority fingerprint
-- hex shape to COLLATE "C" via additive dedicated CHECKs.
--
-- private.supplier_email_deliveries stores claim-time fingerprints under the
-- compound metadata CHECK (MISE-003B / renamed MISE-003C):
--   content_fingerprint ~ '^[a-f0-9]{64}$'
--   authority_fingerprint ~ '^[a-f0-9]{64}$'
-- POSIX [a-f0-9] follows database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; MISE-005AD
-- pinned the sibling OAuth state_hash hex class, and MISE-005X (#432) pins
-- approve-path lower() for the reviewed content fingerprint — but left these
-- durable delivery columns on bare class matches inside the compound CHECK.
--
-- Open MISE-005J (#418) and MISE-005P (#424) rewrite the same compound
-- metadata CHECK for claimed_* cntrl/email pins and intentionally keep the
-- fingerprint hex classes bare. Rewriting that compound here would collide
-- with those stacks. Additive dedicated CHECKs pin the hex shape under
-- COLLATE "C" without dropping or replacing the compound constraint.
--
-- content_fingerprint / authority_fingerprint are the durable SHA-256 bind
-- for claimed supplier-send content and purchase authority. They are null
-- only on unclaimed rows. If LC_CTYPE drifted under a bare class check,
-- dump/restore could accept fingerprint bytes the restored C-locale gate
-- (and approve/complete continuity) would refuse — or the reverse — breaking
-- claim→complete integrity for Gmail supplier sends.
--
-- Scope:
--   - Add nullable-or-hex CHECKs for content_fingerprint and
--     authority_fingerprint with `collate "C" ~ '^[a-f0-9]{64}$'`
-- Does NOT rewrite supplier_email_deliveries_mise_003c_metadata_check
-- (owned by open #418/#424), approve_supplier_send_content (#432),
-- service_complete_supplier_email_send (#428), or provider_message_id
-- CHECKs (#444/#445).
-- Timestamp after MISE-005AL (#446).

alter table private.supplier_email_deliveries
  drop constraint if exists supplier_email_deliveries_content_fingerprint_hex_check;

alter table private.supplier_email_deliveries
  add constraint supplier_email_deliveries_content_fingerprint_hex_check check (
    content_fingerprint is null
    or content_fingerprint collate "C" ~ '^[a-f0-9]{64}$'
  );

comment on constraint supplier_email_deliveries_content_fingerprint_hex_check
  on private.supplier_email_deliveries is
  'MISE-005AM: nullable lowercase SHA-256 content fingerprint under COLLATE "C".';

alter table private.supplier_email_deliveries
  drop constraint if exists supplier_email_deliveries_authority_fingerprint_hex_check;

alter table private.supplier_email_deliveries
  add constraint supplier_email_deliveries_authority_fingerprint_hex_check check (
    authority_fingerprint is null
    or authority_fingerprint collate "C" ~ '^[a-f0-9]{64}$'
  );

comment on constraint supplier_email_deliveries_authority_fingerprint_hex_check
  on private.supplier_email_deliveries is
  'MISE-005AM: nullable lowercase SHA-256 authority fingerprint under COLLATE "C".';
