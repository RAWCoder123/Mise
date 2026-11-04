# Completed-order receive summary (rebased onto main, 2026-11-04)

## Gap

`#232` (`cursor/mise-completed-order-receive-summary`) still owned the
ordered-versus-received line detail for completed `/orders/[id]` screens, but
sat two commits behind `origin/main` (`MISE-004C`, `MISE-005A`) and was not yet
on the authoritative baseline.

## Change

- Cherry-picked the #232 feature onto current `origin/main`.
- Hardened the new receive-summary surface against Unicode-trim inventing:
  item names, units, and discrepancy reasons soft-null when empty,
  Unicode-padded, or control-bearing.
- Removed the English `Inventory item …` and invented `"each"` fallbacks; the
  Orders detail UI owns localized
  `orders.detail.receivedSummary.itemName.none` / `common.notSet` copy.
- Kept tenant isolation, 100-line cap, and demo Metro Produce short-ship
  fixture behavior.

## Verification

- `npm run typecheck`
- Focused `tests/supplierReliability.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`

## Classification

Controlled pilot-ready completed-order review path. Does not reopen receive
editing (#670) or recipe unlink (#671). Hosted RLS / Docker pgTAP remain
environment-blocked.
