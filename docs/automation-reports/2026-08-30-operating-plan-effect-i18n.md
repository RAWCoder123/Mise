# Operating plan effect i18n (2026-08-30)

## Completed
- Added `presentOperatingPlanEffect` to localize structured Today/operating-plan effect bodies from action intent (and shared-task origin) without rewriting durable English `OperatingPlanItem.effect`.
- Wired localization through `presentOperatingPlanItem`.
- Surfaced effect copy on open Today timeline rows via existing `today.plan.effect` chrome.
- Added EN / ES / zh-Hans catalog keys for structured effect bodies.

## Verification
- `npm run typecheck`
- `npm test -- tests/operatingPlanEffectCopy.test.ts`
- `npm test`
- `npm run security:static`

## Out of scope
- Localizing freeform `why` / recommendation.reason (covered by other stacks)
- Daily Phase Brief interpretation strings that embed effect
- Rewriting durable domain English effect strings
