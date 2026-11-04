# Purchase authority recovery CTAs — main rebase

Date: 2026-11-04  
Branch: `cursor/mise-purchase-authority-recovery-main-rebase`  
Supersedes: open #296 (Orders blocker recovery) and stacked open #298 (Home one-tap approve recovery)

## Product

When purchase approval is fail-closed by MISE-003A authority blockers, Orders
and Home now surface blocker-specific recovery CTAs that deep-link to existing
count, inventory item, POS, POS mappings, recipes, suppliers, or orders
surfaces. Presentation-only: no server authority, recommendation quantity, or
approval semantics change.

## Integrity harden (ASCII C)

Inventory item IDs used for recovery deep links are canonicalized under ASCII C
end trim. Unicode-padded or control-bearing IDs soft-null instead of inventing
equality with a clean inventory route via `String#trim`. Supplier blockers fall
back to `/settings/suppliers` when the inventory ID cannot be trusted.

## Verification plan

- `npm run typecheck`
- focused `tests/purchaseAuthority.test.ts` and `tests/purchaseAuthorityUi.test.ts`
- `npm run security:static` / `npm run security:backend` when available
- `npm test`
