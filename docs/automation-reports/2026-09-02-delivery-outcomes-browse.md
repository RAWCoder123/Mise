## Summary
Surface append-only supplier-delivery `action_outcomes` for operators. Memory already absorbs receive lessons; the client previously had no read path.

## Changes
- Domain helpers classify delivery outcomes, map known lessons to i18n codes, and join order/supplier presentation
- Repository `listActionOutcomes` (hosted SELECT + demo) with tenant scope checks
- Application `fetchSupplierDeliveryOutcomes`; order detail evidence attaches measured lessons
- More hub **Delivery lessons** browse (attention/all) with order deep links; EN/ES/zh-Hans
- Demo seeds matching outcomes for existing completed deliveries
- Fail-closed hub pins + route smoke

## Verification
- `npm run typecheck`
- Focused `tests/actionOutcomes.test.ts` + related pins
- `npm test`

## Non-goals
- Does not invent MOQ/lead time/expiration
- Does not change purchase authority, Memory mutations, or receive writers (#193/#194 purchase-loop payload stacks remain separate)
- Does not feed outcomes back into ordering policy
