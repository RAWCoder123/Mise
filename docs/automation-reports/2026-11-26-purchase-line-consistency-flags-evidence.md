# Purchase-line consistency_flags evidence match

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-purchase-line-consistency-flags-evidence-main`

## Gap

`public.purchase_lines.consistency_flags` is allowlist-bounded on current main
but not reconstructed from the recorded line. Hosted ingest/append always
stores flags from `private.purchase_line_consistency_flags`, and product
`normalizePurchaseLineInput` computes the same flags before the RPC. Every
other insert path (direct service_role inserts, append helpers that skip the
ingest preflight, future writers) can still stamp arbitrary allowlisted flags
onto the append-only ledger because the existing column CHECK only requires
the array to be a subset of the four known labels.

Forged empty flags can hide an extended-price or pack-unit contradiction
beneath `confirmed` confidence. Forged flags can also invent a downgrade when
the line is internally consistent. Confidence ceilings and activity downgrade
summaries both trust the stored array.

Stated versus described pack wording is not stored as separate columns. After
coalesce into `pack_size`, the durable reconstruction is stated stand-in =
stored `pack_size`, described = `extract_purchase_pack_size(raw_item_description)`.
That reconstruction matches ingest outcomes for every flag the helper emits.

## Change

- Domain: `invalid_consistency_flags` via
  `purchaseLineConsistencyFlagsEvidence.ts`
- Product `normalizePurchaseLineInput` pins ingest-shape flags against the
  durable stored-shape reconstruction
- Additive helper `private.purchase_line_expected_consistency_flags`
- Additive BEFORE INSERT trigger
  `private.enforce_purchase_line_consistency_flags_evidence`
- NOT VALID CHECK `purchase_lines_consistency_flags_match_check`
- pgTAP plan=12 from assertion call sites (forged empty / invented date-flag
  direct rejects; matching mismatch + clean direct accept; RPC mismatch and
  clean ingest still record reconstructed flags)

## Alone-OK

Orthogonal to purchase-line feature stack #1238/#1250–#1258, unpadded tips
#1283–#1286, cntrl locale pins #414/#477, inventory tips #1259–#1282, and
ASCII-C / length-only tips. Does not rewrite `ingest_purchase_lines` or
`append_purchase_line`. Does not weaken the existing allowlist or confidence
CHECKs. Constraint name is separate from
`purchase_lines_consistency_flags_check`.

## Verification

- `npm run typecheck` — passed
- focused consistency-flags evidence suite — 4/4 passed
- `npm test` — 680 passed / 0 fail / 7 cancelled (inherited withTimeout)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — not run in this environment
