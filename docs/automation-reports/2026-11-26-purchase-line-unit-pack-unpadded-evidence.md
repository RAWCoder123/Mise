# Purchase-line unit/pack unpadded evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-purchase-line-unit-pack-unpadded-main`

## Gap

`public.purchase_lines.unit_of_measure` and `pack_size` are optional on current
main. Hosted `private.purchase_line_text` already btrims those labels before
append, but every other insert path (direct service_role inserts, append helpers
that skip the ingest preflight, future writers) can still stamp padded labels
onto the append-only ledger.

`unit_of_measure` is part of the netting group
`(restaurant, supplier, normalized_item_key, unit_of_measure, currency)`.
Padding invents a parallel net group beside the trimmed label, so credits and
purchases that a human would call the same unit fail to net. Padded `pack_size`
similarly splits pack-unit dimension checks and provenance.

## Change

- Domain: `invalid_unit_of_measure_shape` / `invalid_pack_size_shape` via
  `purchaseLineUnitPackEvidence.ts`
- Product `normalizePurchaseLineInput` fails closed on padded labels; soft-empty
  still nullifies
- Additive BEFORE INSERT trigger
  `private.enforce_purchase_line_unit_pack_unpadded_evidence`
- Separate NOT VALID CHECKs
  `purchase_lines_unit_of_measure_unpadded_check` and
  `purchase_lines_pack_size_unpadded_check`
- pgTAP plan=12 from assertion call sites (padded direct rejects; RPC padded
  trim accept; trimmed + null direct accept)

## Alone-OK

Orthogonal to purchase-line feature stack #1238/#1250–#1258, document-reference
#1283, cntrl locale pin #414, inventory blank source_reference #1282, and
ASCII-C / length-only tips. Does not rewrite `ingest_purchase_lines` or
`append_purchase_line`. Constraint names are separate from the existing
length/cntrl CHECKs.

## Verification

- `npm run typecheck` — passed
- focused unit/pack unpadded suite — 5/5 passed
- `npm test` — 681 passed / 0 fail / 7 cancelled (inherited withTimeout)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — not run in this environment
