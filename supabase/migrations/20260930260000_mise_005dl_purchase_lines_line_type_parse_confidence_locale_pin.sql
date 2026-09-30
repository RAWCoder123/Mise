-- MISE-005DL: pin purchase_lines.line_type and
-- purchase_lines.parse_confidence CHECKs to COLLATE "C",
-- preserving the exact-token allowlists.
--
-- Purchase line ledger vocabulary columns store direction and parse
-- confidence under bare IN allowlists from MISE-004C:
--   purchase_lines.line_type in ('purchase', 'credit')
--   purchase_lines.parse_confidence in
--     ('confirmed', 'estimated', 'could_not_verify')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   line_type:        'purchase' | 'credit'
--   parse_confidence: 'confirmed' | 'estimated' | 'could_not_verify'
--
-- line_type gates signed quantity/extended price, credit-link validity,
-- and net aggregation. parse_confidence gates consistency confidence
-- ranking, ingestion reporting, and operator-visible verification state.
-- POSIX character classes follow database LC_CTYPE. This cluster runs
-- libc en_US.UTF-8. MISE-005A proved locale drift on this cluster; open
-- sibling pins through #523 leave purchase_lines vocabulary on bare IN.
--
-- If LC_CTYPE drifted under a bare-IN purchase_lines vocabulary CHECK,
-- dump/restore could accept direction or confidence bytes the restored
-- C-locale path (and sibling ledger gates) would refuse — or the
-- reverse — breaking credit/purchase direction continuity and
-- confidence ranking across restore.
--
-- Scope:
--   - Replace purchase_lines_line_type_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
--   - Replace purchase_lines_parse_confidence_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite ingest_purchase_lines / supersede_purchase_line,
-- purchase_lines.source, normalization_version, evidence_version,
-- outreach generation_provider, or other bare-IN vocabularies.
-- Timestamp after MISE-005DK (#523).

alter table public.purchase_lines
  drop constraint if exists purchase_lines_line_type_check;

alter table public.purchase_lines
  add constraint purchase_lines_line_type_check
  check (
    line_type in ('purchase', 'credit')
    and line_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint purchase_lines_line_type_check
  on public.purchase_lines is
  'MISE-005DL: exact purchase/credit allowlist plus ASCII shape under COLLATE "C". Purchase line direction vocabulary.';

comment on column public.purchase_lines.line_type is
  'Purchase line direction. Allowed values: purchase, credit under COLLATE "C". Stated explicitly; never inferred from sign.';

alter table public.purchase_lines
  drop constraint if exists purchase_lines_parse_confidence_check;

alter table public.purchase_lines
  add constraint purchase_lines_parse_confidence_check
  check (
    parse_confidence in ('confirmed', 'estimated', 'could_not_verify')
    and parse_confidence collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint purchase_lines_parse_confidence_check
  on public.purchase_lines is
  'MISE-005DL: exact confirmed/estimated/could_not_verify allowlist plus ASCII shape under COLLATE "C". Purchase line parse confidence vocabulary.';

comment on column public.purchase_lines.parse_confidence is
  'Parse confidence for the purchase line. Allowed values: confirmed, estimated, could_not_verify under COLLATE "C". Confidence is only ever lowered, never raised.';
