-- MISE-005DN: pin purchase_lines.source CHECK to COLLATE "C",
-- preserving the exact-token allowlist.
--
-- Purchase line ledger source vocabulary stores document provenance under a
-- bare IN allowlist from MISE-004C:
--   purchase_lines.source in
--     ('invoice', 'order_confirmation', 'manual_entry', 'credit_memo')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'invoice'             — supplier invoice document
--   'order_confirmation'  — supplier order confirmation
--   'manual_entry'        — operator-entered purchase line
--   'credit_memo'         — supplier credit memo document
--
-- source gates idempotency space (with supplier_scope and document
-- reference), credit-memo document separation from invoices, ingestion
-- provenance, and operator-visible document type. POSIX character classes
-- follow database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A
-- proved locale drift on this cluster; open sibling pins through #525
-- leave purchase_lines.source on bare IN. Open tip #524/#525 explicitly
-- deferred this column.
--
-- If LC_CTYPE drifted under a bare-IN purchase_lines.source CHECK,
-- dump/restore could accept document-source bytes the restored C-locale
-- path (and sibling ledger gates) would refuse — or the reverse —
-- breaking purchase-line document provenance and idempotency continuity
-- across restore.
--
-- Scope:
--   - Replace purchase_lines_source_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite ingest_purchase_lines / supersede_purchase_line,
-- purchase_lines.line_type, parse_confidence, normalization_version,
-- evidence_version, outreach generation_provider, or other bare-IN
-- vocabularies. Timestamp after MISE-005DM (#525).

alter table public.purchase_lines
  drop constraint if exists purchase_lines_source_check;

alter table public.purchase_lines
  add constraint purchase_lines_source_check
  check (
    source in ('invoice', 'order_confirmation', 'manual_entry', 'credit_memo')
    and source collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint purchase_lines_source_check
  on public.purchase_lines is
  'MISE-005DN: exact invoice/order_confirmation/manual_entry/credit_memo allowlist plus ASCII shape under COLLATE "C". Purchase line document source vocabulary.';

comment on column public.purchase_lines.source is
  'Purchase line document source. Allowed values: invoice, order_confirmation, manual_entry, credit_memo under COLLATE "C".';
