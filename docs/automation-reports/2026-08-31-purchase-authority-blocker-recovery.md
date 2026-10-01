# Purchase authority blocker recovery CTAs

Date: 2026-08-31  
Branch: `cursor/mise-purchase-authority-blocker-recovery`  
Base: `origin/main` @ `20b28e5`

## Problem

Orders review already loaded `PurchaseAuthorityResult` blockers and disabled
Approve while blocked, but operators only saw localized prose. Pilot stage 15
expects blocker-specific recovery; without deep links, stale counts, unverified
units, recipe gaps, and POS mapping issues became dead ends.

## Change

- Added `resolvePurchaseAuthorityBlockerRecovery` in
  `services/domain/purchaseAuthority.ts` to map stable blocker codes to existing
  routes using authority evidence (`inventoryItemId` when required).
- `RecommendationDecisionRow` renders a 44px recovery action under each of the
  first three blockers when a safe route exists.
- Added EN/ES/zh-Hans CTA copy under `orders.authority.recovery.*`.
- Informational/founder-only codes (`ordering_disabled`, `send_in_progress`,
  `planning_revision_stale`, `recommendation_no_longer_actionable`) intentionally
  have no CTA.

## Non-goals

- No migrations, RPC changes, or client table DML.
- Does not invent inventory/POS facts or change approval authority.
- Does not switch Orders lanes via query params (draft/delivery CTAs land on
  `/orders`; operator selects lane).

## Tests

- `tests/purchaseAuthority.test.ts` recovery mapping coverage
- `tests/purchaseAuthorityUi.test.ts` UI contract for recovery deep links
