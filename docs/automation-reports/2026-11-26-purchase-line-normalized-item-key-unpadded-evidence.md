# Purchase-line normalized_item_key unpadded evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-purchase-line-normalized-item-key-unpadded-main`

## Gap

`public.purchase_lines.normalized_item_key` is optional on current main. Hosted
append always stores the key from `private.normalize_purchase_item_key`, which
already btrims, and product `normalizePurchaseLineDescription` also trims. Every
other insert path (direct service_role inserts, append helpers that skip the
ingest preflight, future writers) can still stamp a padded key onto the
append-only ledger because the existing column CHECK only requires
`length(normalized_item_key) between 1 and 500`.

`normalized_item_key` is part of the netting group
`(restaurant, supplier, normalized_item_key, unit_of_measure, currency)`.
Padding invents a parallel net group beside the trimmed key, so credits and
purchases that a human would call the same item fail to net. The match CHECK
against `normalize_purchase_item_key(raw_item_description)` already refuses
mismatched keys with a generic violation; this tip fails closed with an
explicit unpadded contract.

## Change

- Domain: `invalid_normalized_item_key_shape` via
  `purchaseLineNormalizedItemKeyEvidence.ts`
- Product `normalizePurchaseLineInput` fails closed on padded computed keys;
  soft-empty still nullifies
- Additive BEFORE INSERT trigger
  `private.enforce_purchase_line_normalized_item_key_unpadded_evidence`
- NOT VALID CHECK `purchase_lines_normalized_item_key_unpadded_check`
- pgTAP plan=12 from assertion call sites (padded / tab-padded direct rejects;
  mismatch still fails `purchase_lines_normalized_key_check`; RPC padded
  description still trims to a matching unpadded key; trimmed + null direct
  accept)

## Alone-OK

Orthogonal to purchase-line feature stack #1238/#1250–#1258, raw-description
#1285, unit/pack #1284, document-reference #1283, cntrl locale pin #414 /
normalized-key locale pin #477, inventory tips #1259–#1282, and ASCII-C /
length-only tips. Does not rewrite `ingest_purchase_lines` or
`append_purchase_line`. Does not weaken `purchase_lines_normalized_key_check`.
Constraint name is separate from the existing length and match CHECKs.

## Verification

- `npm run typecheck` — passed
- focused normalized-item-key unpadded suite — 4/4 passed
- `npm test` — 680 passed / 0 fail / 7 cancelled (inherited withTimeout)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — not run in this environment
