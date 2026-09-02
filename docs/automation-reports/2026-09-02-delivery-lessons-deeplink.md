## Summary
Deep-link Insights and Daily Report into Delivery lessons when measured receive outcomes need attention.

Depends on Delivery lessons browse (#347). Distinct from Restaurant Memory review (#354).

## Changes
- Domain `countAttentionSupplierDeliveryOutcomes` + shared attention-kind helper
- Application `fetchAttentionSupplierDeliveryOutcomeCount` (outcomes-only, no Memory mutation)
- Presentation `deliveryLessonsNavigation` href + offer gate
- Insights: CTA inside How Mise Knows when attention > 0; standalone card if memory absent
- Daily Report: CTA under supplier reliability when attention > 0
- EN / ES / zh-Hans copy; static pins

## Verification
- `npm run typecheck`
- Focused delivery-lessons + action-outcome tests
- `npm test`
- `npm run security:static` / `npm run design:static`

## Non-goals
- Does not invent MOQ / lead time / expiration
- Does not change receive writers, Memory mutations, or ordering policy
- Does not duplicate #354 restaurant-memory deep-links
