# MISE-005IY — ingest document-reference cntrl locale pin

Date: 2026-10-06  
Branch: `cursor/mise-ingest-document-reference-cntrl-locale-pin`  
Base: `origin/main` @ `78da7376`

## Gap

`public.ingest_purchase_lines` rejected control characters in
`p_source_document_reference` with bare POSIX `[[:cntrl:]]` (LC_CTYPE).
MISE-005F (#414) re-pins the append-only `purchase_lines` CHECK and
`purchase_line_text` parser under `COLLATE "C"`, but left this writer
preflight bare for compose with open ingest rewrites. Locale drift could
make the writer accept document-reference bytes a restored C-locale path
(or the CHECK) would refuse — or the reverse.

## Change

- Additive migration
  `20261007140000_mise_005iy_ingest_document_reference_cntrl_locale_pin.sql`
  rewrites `ingest_purchase_lines` so the preflight uses
  `document_reference collate "C" ~ '[[:cntrl:]]'`.
- Application `ingestPurchaseLines` rejects the same ASCII C controls and
  length bound before the RPC so demo/hosted paths agree.
- Source-pin Jest + pgTAP fixture (plan 6 from 6 assertion call sites).

## Out of scope

- `purchase_lines` text CHECKs / `purchase_line_text` (#414)
- `octet_length` payload bound (#415) — later ingest rewrites must keep this
  COLLATE `"C"` gate
- Purchase-line unit helpers (#666)

## Classification

Controlled pilot-ready codebase tip. Not App Store submission-ready.
