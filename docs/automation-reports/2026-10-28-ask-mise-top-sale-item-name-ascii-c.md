# MISE-005SY Ask Mise top-sale item-name ASCII C

Date: 2026-10-28

## Summary

Pins AI-layer `answerAskMise` sales-intent `topItems[0].item_name` hydrate to
ASCII C so Unicode `.trim()` cannot invent a clean durable POS item label into
the operator-facing `ask.answer.sales.topItem` clause.

## Inventing proof

Prior path Unicode-trimmed the top POS sale item name before interpolating it
into the grounded sales answer:

```text
'\u2003Chicken Bowl\u2003'
  .trim()
  === 'Chicken Bowl'
```

Soft-empty Unicode-only padding also collapsed through `.trim()` into the
intentional `topSale ? … : null` drop.

ASCII C prep end-trims only, fail-closes (soft-null) when Unicode padding
remains or controls appear, preserving the existing `topSale ? … : null`
branch.

## Change

- Add `services/domain/askMiseTopSaleItemNameIdentity.ts`
- Route Ask Mise sales `topSale` through `normalizeAskMiseTopSaleItemName`
- Leave `classifyAskMiseIntent` / question Unicode trim alone (#700 / #879)
- Leave pilot-readiness sale item Set keys (#875), Insights sales labels
  (#869), and operational-findings unmapped menu-item names (#924) alone

## Verification

- Focused: `tests/askMiseTopSaleItemNameAsciiC.test.ts` (4/4)
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test` (687 total / 680 pass / 0 fail / 7 cancelled inherited recalculationCycles; tip +4 vs main ~683)
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK with #879 / #700 / #875 / #869 / #924. Keep
`askMiseTopSaleItemNameIdentity.ts` separate from Ask Mise question /
pilot-readiness / Insights / findings helpers. Do not tip #879 as covering
sales top-item answer labels; do not tip this as a substitute for #875.
