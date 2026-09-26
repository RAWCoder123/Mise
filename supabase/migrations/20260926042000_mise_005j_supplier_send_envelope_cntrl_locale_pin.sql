-- MISE-005J: pin supplier-send / Gmail delivery envelope cntrl CHECKs to COLLATE "C".
--
-- private.gmail_credentials.sender_email and private.supplier_email_deliveries
-- (rfc_message_id plus claimed_from / claimed_to / claimed_subject on the
-- MISE-003C metadata CHECK) still reject control characters with bare POSIX
-- [[:cntrl:]], which follows database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A already proved locale drift on this cluster for
-- lower() / [[:alnum:]]; MISE-005B / MISE-005F / MISE-005H / MISE-005I
-- re-pinned suppliers, purchase lines, purchase-decision units, and POS
-- provider identity with `collate "C" !~ '[[:cntrl:]]'`.
--
-- These envelope fields are the durable From / To / Subject / Message-ID
-- claim on every supplier send. If a glibc/ICU change reclassified a stored
-- byte under bare [[:cntrl:]], pg_dump/restore would reject delivery claim
-- rows the source accepted — breaking send-completion and audit continuity.
--
-- Scope:
--   - Reattach gmail_credentials.sender_email CHECK with COLLATE "C"
--   - Reattach supplier_email_deliveries.rfc_message_id CHECK with COLLATE "C"
--   - Reattach supplier_email_deliveries_mise_003c_metadata_check with
--     claimed_from / claimed_to / claimed_subject COLLATE "C" cntrl rejection
-- Does NOT rewrite claim / approve / complete RPCs (compose with open
-- supplier-send and Gmail stacks). Restore authority is the CHECK.

alter table private.gmail_credentials
  drop constraint if exists gmail_credentials_sender_email_check;

alter table private.gmail_credentials
  add constraint gmail_credentials_sender_email_check
    check (
      length(sender_email) between 3 and 254
      and sender_email = lower(sender_email)
      and sender_email collate "C" !~ '[[:cntrl:]]'
    );

alter table private.supplier_email_deliveries
  drop constraint if exists supplier_email_deliveries_rfc_message_id_check;

alter table private.supplier_email_deliveries
  add constraint supplier_email_deliveries_rfc_message_id_check
    check (
      length(rfc_message_id) between 6 and 512
      and rfc_message_id collate "C" !~ '[[:cntrl:]]'
    );

alter table private.supplier_email_deliveries
  drop constraint if exists supplier_email_deliveries_mise_003c_metadata_check;

alter table private.supplier_email_deliveries
  add constraint supplier_email_deliveries_mise_003c_metadata_check check (
    (
      content_version is null
      and content_fingerprint is null
      and authority_version is null
      and authority_fingerprint is null
      and approved_action_id is null
      and claimed_recommendation_ids is null
      and claimed_from is null
      and claimed_to is null
      and claimed_subject is null
      and credential_generation is null
      and claimed_content_revision is null
      and authority_evaluated_at is null
      and supplier_id is null
    )
    or (
      content_version in ('mise.supplier_send.v1', 'mise.supplier_send.v2')
      and (
        (content_version = 'mise.supplier_send.v1' and supplier_id is null)
        or (content_version = 'mise.supplier_send.v2' and supplier_id is not null)
      )
      and content_fingerprint ~ '^[a-f0-9]{64}$'
      and authority_version = 'mise.purchase_authority.v1'
      and authority_fingerprint ~ '^[a-f0-9]{64}$'
      and approved_action_id is not null
      and claimed_recommendation_ids is not null
      and pg_catalog.cardinality(claimed_recommendation_ids) between 1 and 250
      and claimed_from is not null
      and pg_catalog.length(claimed_from) between 3 and 254
      and claimed_from = pg_catalog.lower(pg_catalog.btrim(claimed_from))
      and claimed_from collate "C" !~ '[[:cntrl:]]'
      and claimed_to is not null
      and pg_catalog.length(claimed_to) between 3 and 254
      and claimed_to = pg_catalog.lower(pg_catalog.btrim(claimed_to))
      and claimed_to collate "C" !~ '[[:cntrl:]]'
      and claimed_subject is not null
      and pg_catalog.length(claimed_subject) between 1 and 500
      and claimed_subject = pg_catalog.btrim(claimed_subject)
      and claimed_subject collate "C" !~ '[[:cntrl:]]'
      and credential_generation > 0
      and claimed_content_revision > 0
      and authority_evaluated_at is not null
    )
  );

comment on constraint gmail_credentials_sender_email_check
  on private.gmail_credentials is
  'MISE-005J: sender_email length 3–254, lowercased, ASCII C [[:cntrl:]] rejection (COLLATE "C").';

comment on constraint supplier_email_deliveries_rfc_message_id_check
  on private.supplier_email_deliveries is
  'MISE-005J: rfc_message_id length 6–512 and ASCII C [[:cntrl:]] rejection (COLLATE "C").';

comment on constraint supplier_email_deliveries_mise_003c_metadata_check
  on private.supplier_email_deliveries is
  'MISE-005J: claimed envelope From/To/Subject use COLLATE "C" [[:cntrl:]] rejection; otherwise preserves MISE-003C metadata contract.';
