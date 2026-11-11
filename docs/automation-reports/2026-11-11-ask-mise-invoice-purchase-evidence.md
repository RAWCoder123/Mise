# Ask Mise invoice purchase-line evidence

Date: 2026-11-11  
Branch: `cursor/mise-ask-mise-invoice-purchase-evidence-main`  
Baseline: `origin/main` @ `78da7376`

## Gap

Ask Mise could answer stock, orders, and sales from the live board, but invoice / supplier-spend questions had no MISE-004C purchase-line grounding. Operators could only see estimated order cost on Orders (#1255 separately), and Ask Mise risked either silence or invented totals.

## Change

- Pure `buildAskMisePurchaseEvidence` collapses `list_purchase_line_net_by_item` groups into bounded facts (priced groups, single-currency net spend, unmatched credits, top nets).
- Ask Mise gains an `invoices` intent (EN/ES/zh-Hans) classified before prep/`line` and generic order/supplier keywords.
- `/ask-mise` loads purchase-line nets with the board and passes evidence into answers.
- Empty or unpriced ledgers fail closed; multi-currency nets are never combined; sales totals are never used as invoice spend.

## Alone-OK

Complementary to #1255 (Orders chart), #1238 (browse UI), #1250–#1254 (ledger write/link/seed stack), and #1252 (key aliases). No migration. Does not mutate purchasing authority.

## Verification

- `npm run typecheck`
- focused Ask Mise / evidence suites
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
