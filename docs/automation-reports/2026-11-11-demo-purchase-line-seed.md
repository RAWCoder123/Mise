# Demo purchase-line ledger seed

Date: 2026-11-11  
Branch: `cursor/mise-demo-purchase-line-seed-main`  
Baseline: `origin/main` @ `78da7376`

## Gap

MISE-004C landed with empty demo `purchaseLines: []`. Open browse / entry /
correction / alias / link tips therefore had nothing realistic to show in demo
mode unless an operator first typed invoice lines by hand.

## Change

- Schema version **14** seeds five append-only purchase lines plus matching
  `purchase_lines_recorded` activity:
  - Local Produce invoice with two confirmed lines
  - Fresh Poultry invoice with one confirmed line and one unpriced
    `could_not_verify` line (attention activity)
  - Fresh Poultry credit memo whose wording stays unmatched under exact-key
    netting
- Repair fills empty ledgers only when upgrading from `< 14`. Operator ingest
  history and post-14 empty arrays are retained.

## Alone-OK

Does not touch browse (#1238), manual entry (#1251), correction (#1253),
aliases (#1252), inventory links (#1250), export (#402), ingest guards
(#415/#398), or receive/FEFO stacks.

## Verification

- Focused `tests/demoPurchaseLineSeed.test.ts`
- Related schema pins in demo workflow / supplier-identity / purchase-decision
  memory tests updated to 14
- `npm run typecheck`
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
