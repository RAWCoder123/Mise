# Purchase-line source document reference evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-purchase-line-document-reference-evidence-main`

## Gap

`public.purchase_lines.source_document_reference` is part of the durable
idempotency key. Hosted `ingest_purchase_lines` already nullif-trims blank
values before append, but every other insert path (direct service_role inserts,
append helpers that skip the ingest preflight) can still stamp whitespace-only
or padded document references onto the append-only ledger.

Blank padding invents a parallel document identity beside the trimmed label, so
re-ingest of the same invoice can record duplicate lines instead of settling as
already-on-file.

## Change

- Domain: `invalid_source_document_reference_shape` via
  `validatePurchaseLineSourceDocumentReferenceEvidence`
- Application ingest fails closed on blank/padded refs before repository write
- Additive BEFORE INSERT trigger
  `private.enforce_purchase_line_document_reference_evidence`
- NOT VALID CHECK mirrors the same rule without rewriting history
- pgTAP plan=10 from assertion call sites (spaces/tabs/padded direct rejects,
  RPC blank still required, RPC padded trim accept, trimmed direct accept)

## Alone-OK

Orthogonal to purchase-line feature stack #1238/#1250–#1258, cntrl locale pin
#414, document-reference cntrl preflight #667, currency/source locale pins, and
inventory blank source_reference #1282. Does not rewrite
`ingest_purchase_lines` or `append_purchase_line`. Uses a separate unpadded
CHECK name so it does not drop #414's cntrl-bound constraint.

## Verification

- `npm run typecheck`
- focused document-reference suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run supabase:test` — not run in this environment
