-- MISE-005BT: pin private.supplier_email_deliveries content_version and
-- authority_version shape CHECKs to COLLATE "C" via additive dedicated
-- CHECKs.
--
-- private.supplier_email_deliveries stores claim-time contract versions
-- under the compound metadata CHECK (MISE-003B / renamed MISE-003C):
--   content_version in ('mise.supplier_send.v1', 'mise.supplier_send.v2')
--   authority_version = 'mise.purchase_authority.v1'
-- Those allowlists are exact string equality inside the compound CHECK and
-- carry no dedicated ASCII shape gate under COLLATE "C". Unclaimed rows
-- keep both columns null.
--
-- Writers mint the durable ASCII version tokens:
--   'mise.supplier_send.v1' / 'mise.supplier_send.v2'
--   'mise.purchase_authority.v1'
-- (private.build_supplier_send_content / claim / approve paths from
-- MISE-003B/003C). Without a dedicated COLLATE "C" shape CHECK, dump/restore
-- under LC_CTYPE drift can accept version bytes the restored C-locale path
-- (and sibling machine-identity gates) would refuse — or the reverse —
-- breaking claim→complete contract continuity for Gmail supplier sends.
--
-- Open MISE-005J (#418) and MISE-005P (#424) rewrite the same compound
-- metadata CHECK for claimed_* cntrl/email pins and intentionally leave
-- content_version / authority_version on the bare allowlist equality.
-- Rewriting that compound here would collide with those stacks. Additive
-- dedicated CHECKs pin the ASCII shape under COLLATE "C" without dropping
-- or replacing the compound constraint.
--
-- Sibling tips already pinned fingerprint hex (#447), last_error_code (#450),
-- rfc_message_id (#418), and provider_message_id (#444) on this table; this
-- tip covers the remaining claim-time version identity columns.
--
-- Scope:
--   - Add nullable-or-shape CHECKs for content_version and
--     authority_version with `collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'`
-- Does NOT rewrite supplier_email_deliveries_mise_003c_metadata_check
-- (owned by open #418/#424), claim/approve/complete RPCs, fingerprint hex
-- CHECKs (#447), last_error_code (#450), or provider_message_id (#444/#445).
-- Timestamp after MISE-005BS (#479).

alter table private.supplier_email_deliveries
  drop constraint if exists supplier_email_deliveries_content_version_check;

alter table private.supplier_email_deliveries
  add constraint supplier_email_deliveries_content_version_check check (
    content_version is null
    or content_version collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint supplier_email_deliveries_content_version_check
  on private.supplier_email_deliveries is
  'MISE-005BT: nullable ASCII supplier-send content_version under COLLATE "C".';

alter table private.supplier_email_deliveries
  drop constraint if exists supplier_email_deliveries_authority_version_check;

alter table private.supplier_email_deliveries
  add constraint supplier_email_deliveries_authority_version_check check (
    authority_version is null
    or authority_version collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint supplier_email_deliveries_authority_version_check
  on private.supplier_email_deliveries is
  'MISE-005BT: nullable ASCII purchase-authority version under COLLATE "C".';
