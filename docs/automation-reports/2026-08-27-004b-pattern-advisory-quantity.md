# MISE-004B pattern advisory quantity (2026-08-27)

## Completed

- Bounded advisory helper `applyEstablishedPatternAdvisoryQuantity` /
  `selectAdvisoryPurchaseDecisionPattern` in `purchaseDecisionMemory.ts`
- Hosted `calculateOperationalSignals` prefers established pattern ratios over
  absolute approved medians and discloses influence in reason text
- Demo `rebuildPurchaseRecommendations` and `miseDomain.buildRecommendationInserts`
  keep parity
- Additive migration exposes factual patterns on the planning snapshot via
  `private.purchase_decision_patterns_json`
- Boundary and unit tests updated for 004B

## Not changed

- Approve / dismiss / undo / send authority
- Orders quantity input prefills
- Dismissal-based suppression
- Purchase-loop variance measurement (owned by open #193/#194)

## Verification

- Targeted advisory + boundary tests
- `npm run typecheck`
- `npm test`
- `npm run security:backend` when available
