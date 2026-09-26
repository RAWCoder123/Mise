-- MISE-005P: pin supplier-send claimed_from / claimed_to lower + mailbox shape
-- to COLLATE "C".
--
-- private.supplier_email_deliveries claimed_from / claimed_to still require:
--   claimed_from = lower(btrim(claimed_from))
--   claimed_from !~ '[[:cntrl:]]'
-- with no mailbox shape. lower() and POSIX classes follow database LC_CTYPE.
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; MISE-005J re-pinned the cntrl half of the metadata CHECK but left
-- lower() and [[:space:]] shape bare for a sibling tip (same pattern as
-- MISE-005J → MISE-005O for gmail_credentials.sender_email and
-- MISE-005K → MISE-005N for supplier_recipients.email).
--
-- claimed_from / claimed_to are the durable From / To claim on every supplier
-- send. If LC_CTYPE drifted under bare lower/[[:space:]]/[[:cntrl:]],
-- dump/restore could reject delivery claim rows the source accepted — breaking
-- send-completion and audit continuity. Without mailbox shape, a restored row
-- could also hold a non-mailbox string the send path treated as an address.
--
-- Scope:
--   - Reattach supplier_email_deliveries_mise_003c_metadata_check so
--     claimed_from / claimed_to use COLLATE "C" lower, cntrl, and
--     [[:space:]] mailbox shape (and keep claimed_subject cntrl COLLATE "C")
-- Does NOT rewrite gmail_credentials / rfc_message_id CHECKs (MISE-005J /
-- MISE-005O) or claim / approve / complete send RPCs. Restore authority is
-- the CHECK. Must apply after MISE-005J when both land so 005J cannot wipe
-- the shape pins.

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
      and claimed_from = pg_catalog.btrim(claimed_from)
      and claimed_from = pg_catalog.lower(claimed_from collate "C") collate "C"
      and claimed_from collate "C" !~ '[[:cntrl:]]'
      and claimed_from collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      and claimed_to is not null
      and pg_catalog.length(claimed_to) between 3 and 254
      and claimed_to = pg_catalog.btrim(claimed_to)
      and claimed_to = pg_catalog.lower(claimed_to collate "C") collate "C"
      and claimed_to collate "C" !~ '[[:cntrl:]]'
      and claimed_to collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      and claimed_subject is not null
      and pg_catalog.length(claimed_subject) between 1 and 500
      and claimed_subject = pg_catalog.btrim(claimed_subject)
      and claimed_subject collate "C" !~ '[[:cntrl:]]'
      and credential_generation > 0
      and claimed_content_revision > 0
      and authority_evaluated_at is not null
    )
  );

comment on constraint supplier_email_deliveries_mise_003c_metadata_check
  on private.supplier_email_deliveries is
  'MISE-005P: claimed_from/claimed_to use C-locale lower + ASCII C [[:cntrl:]] + [[:space:]] mailbox shape; claimed_subject keeps COLLATE "C" cntrl; otherwise preserves MISE-003C metadata contract.';
