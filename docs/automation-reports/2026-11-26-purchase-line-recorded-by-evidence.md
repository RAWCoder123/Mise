# Purchase-line recorded_by INSERT evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-purchase-line-recorded-by-evidence-main`

## Gap

`public.purchase_lines.recorded_by` is nullable so account deletion can
anonymize only the recorder while preserving append-only business fields.
Hosted `private.append_purchase_line` stamps `auth.uid()`, but any insert path
that reaches the table can still mint an unattributable purchase or credit row
with `recorded_by = null` — invoice history Activity / netting / audit analysis
cannot pin to an operator.

## Change

- Domain: `validatePurchaseLineRecordedByEvidence` rejects
  `missing_recorded_by` when the recorder id is null, undefined, or blank.
- Additive BEFORE INSERT trigger
  `private.enforce_purchase_line_recorded_by_evidence` with the same rule.
- Intentionally **no** NOT NULL CHECK — a CHECK would block the auth
  ON DELETE SET NULL anonymization UPDATE escape.
- pgTAP plan=8 from assertion call sites: null direct-insert reject, attributed
  direct insert accept, manager RPC ingest accept + recorded_by stamp, account
  deletion anonymization still clears only `recorded_by`.

## Alone-OK

Orthogonal to purchase-line padding/source/consistency/credit/supersede tips
#1283–#1290, inventory actor attribution #1280, and product purchase-line
workflows #1238/#1250–#1258. Does not rewrite `ingest_purchase_lines`,
`append_purchase_line`, `supersede_purchase_line`, or
`reject_purchase_line_mutation`. Does not restore table-level NOT NULL.

## Verification

- `npm run typecheck`
- focused recorded-by suite
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
- `npm run supabase:test` — not run in this environment (Docker)
