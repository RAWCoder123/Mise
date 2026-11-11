# Purchase-line correction UI

Date: 2026-11-11  
Baseline: `origin/main` @ `78da7376`

## Gap

MISE-004C already exposes `public.supersede_purchase_line` / `correctPurchaseLine`,
but operators had no screen to append a correction. Wrong invoice quantities or
prices therefore stayed current unless a developer called the RPC.

## Change

- More hub row → `/more/purchase-line-correction`
- Presentation helpers list current lines, prefill drafts, reject no-op /
  invalid corrections, and lock document identity / line type / line index
- Manager-gated form submits through `correctPurchaseLine`; staff stays view-only
- EN / ES / zh-Hans copy, hub readiness / tenant-safety consumers, route smoke

## Alone-OK

Complementary to #1238 browse, #1251 manual entry, #1250 inventory links,
#1252 item-key aliases, and #415/#398 ingest guards. No migration. Does not
touch receive, FEFO, waste, or purchase-authority stacks.

## Verification

- `npm run typecheck` — pass
- focused `tests/purchaseLineCorrection.test.ts` — 6/6
- `npm test` — 689 total / 682 pass / 0 fail / 7 cancelled (inherited withTimeout)
- `npm run security:static` — pass
- `npm run security:backend` — pass
- `npm run design:static` — pass
