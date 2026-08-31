# Home one-tap approve authority recovery

Date: 2026-08-31  
Branch: `cursor/mise-home-approve-authority-recovery`  
Stacks on: `cursor/mise-purchase-authority-blocker-recovery` (PR #296)

## Problem

Home one-tap approve caught all failures as generic `home.approvals.approveError`.
Operators who hit a MISE-003A purchase-authority block saw no blocker-specific
copy and no recovery deep link, even though Orders → Review already surfaces
those recoveries via `resolvePurchaseAuthorityBlockerRecovery`.

## Change

- Detect `PurchaseAuthorityBlockedError` on Home approve
- Persist per-card authority results and render the same blocker panel + recovery
  CTAs used on Orders
- Disable only the blocked one-tap Approve button; Review navigation remains available
- Reuse existing EN/ES/zh-Hans `orders.authority.*` recovery copy

## Non-goals

- No migrations, RPC changes, or client table DML
- Does not change purchase approval authority or invent operational facts
- Does not rebase Home approval evidence UI from PR #209

## Verification

- `npm run typecheck`
- Focused: `tests/purchaseAuthority.test.ts`, `tests/purchaseAuthorityUi.test.ts`
- `npm test`
- `npm run security:static`
