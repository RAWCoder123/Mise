# MISE-005RA orderPresentation line labels ASCII C (2026-10-26)

Tip: `cursor/mise-order-presentation-line-ascii-c`.

## Inventing proof

`utils/orderPresentation.ts` `scanSupplierOrderLines` Unicode-trimmed each raw
order-message line and each captured `itemName` / `quantityLabel` before
emptiness checks, non-item header skips, dash matching, and stored draft-line
identity (`'\u2003Roma tomatoes\u2003'.trim() === 'Roma tomatoes'`). Em-space /
NBSP padding therefore invented clean draft labels, and an em-space-padded
header could invent a clean non-item skip
(`'^order draft for'.test('\u2003Order draft…\u2003'.trim())`).

Soft empty / Unicode-only space softs to omit (prior skip). Em-space-padded
non-empty keeps padding (no inventing equality with a clean label). NBSP folds
then C whitespace collapses to ordinary ASCII spaces.

Open #703 / MISE-005KH owns demo unit-price Kelvin haystack
(`orderPresentationIdentity.ts` / `estimateOrderPresentationUnitCents`) and
intentionally left line-label Unicode trim alone.

## Change

- `services/domain/orderPresentationLineIdentity.ts` — NBSP fold + C whitespace
  collapse + ASCII space trim
- Wire `scanSupplierOrderLines` through soft `normalizeOrderPresentationLineLabel`
- Leave `estimateLineCents` / `itemName.toLowerCase()` demo-price path to #703
- Leave generated-order-message Notes: strip (#847) and supplier operator_note
  (#840) alone

## Merge notes

Alone-OK with #703. Keep `orderPresentationLineIdentity.ts` separate from
`orderPresentationIdentity.ts`. When landing with #703, do not retip Kelvin
demo-price asserts; this tip does not rewrite `estimateLineCents`. Do not tip
#703 as covering line-label trim; do not tip this as a substitute for #703.

## Next tip preference

Prefer land/rebase of open stacks #348–#886 and #192 when merge capacity
exists. Next inventing candidates: verify live on main for remaining
Unicode-trim+use-result paths not tipped through #886 / #005RA — prefer paths
that Unicode-trim **and use the trimmed result**. Do not retip #886 Log
Delivery, #885 count-sheet, #703 demo price, or this line-label tip.

## Verification

- focused `tests/orderPresentationLineAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`
