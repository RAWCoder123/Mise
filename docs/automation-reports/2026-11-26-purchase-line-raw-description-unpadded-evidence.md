# Purchase-line raw_item_description unpadded evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-purchase-line-raw-description-unpadded-main`

## Gap

`public.purchase_lines.raw_item_description` is required on current main. Hosted
`private.purchase_line_text` already btrims that label before append, and
product `boundedText` trims before normalize, but every other insert path
(direct service_role inserts, append helpers that skip the ingest preflight,
future writers) can still stamp padded descriptions onto the append-only ledger
because the existing CHECK only requires `length(btrim(...)) between 1 and 500`.

`raw_item_description` is the durable source wording for the line and the input
to `normalized_item_key`. Padding invents provenance beside the hosted trimmed
store even when the normalized key still agrees.

## Change

- Domain: `invalid_raw_item_description_shape` via
  `purchaseLineRawDescriptionEvidence.ts`
- Product `normalizePurchaseLineInput` fails closed on blank or padded
  descriptions
- Additive BEFORE INSERT trigger
  `private.enforce_purchase_line_raw_description_unpadded_evidence`
- Separate NOT VALID CHECK
  `purchase_lines_raw_item_description_unpadded_check`
- pgTAP plan=10 from assertion call sites (blank/padded direct rejects; RPC
  blank fail-closed; RPC padded trim accept; trimmed direct accept)

## Alone-OK

Orthogonal to purchase-line feature stack #1238/#1250–#1258, document-reference
#1283, unit/pack unpadded #1284, cntrl locale pin #414, ASCII-C pin #859, and
inventory security tips #1259–#1282. Does not rewrite `ingest_purchase_lines` or
`append_purchase_line`. Constraint name is separate from the existing
length/cntrl CHECKs.

## Verification

- `npm run typecheck` — passed
- focused raw-description unpadded suite — 4/4 passed
- `npm test` — 687 passed / 0 fail / 0 cancelled
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — not run in this environment
