# Cancel / abandon draft supplier orders (main-rebase, 2026-11-05)

Tip: `cursor/mise-cancel-draft-supplier-order-main-rebase`

Supersedes stale CONFLICTING #282 (`cursor/mise-cancel-draft-supplier-order`)
without wholesale resume of that branch.

## Problem
After the Orders undo toast expires, managers could not abandon a stuck draft
supplier order without undoing each approved line individually (when that path
was still available). Statuses were only draft/sent/completed.

## Fix
- Additive RPC `cancel_supplier_order_draft` (manager+): restores every linked
  approved recommendation through `undo_purchase_recommendation_action`
  (purchase-decision memory included), cancels the `send_supplier_order` mise
  action, deletes the empty draft, audits `supplier_order_draft_cancelled`.
- Fails closed for sent/completed orders, in-flight/unknown delivery evidence,
  executing/executed/unverified send actions, and newer pending conflicts.
- Demo parity + order detail Cancel draft (confirm) + EN/ES/zh-Hans.
- Migration timestamp `20261105140000` (after current main and #1113 tip).

## Verification
- `npm run typecheck`
- `npm test` (focused cancel + full suite)
- `npm run security:static` (and security:backend when available)
