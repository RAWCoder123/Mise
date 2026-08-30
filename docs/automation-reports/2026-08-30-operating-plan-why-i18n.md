# Operating plan why i18n (2026-08-30)

## Summary

Localize structured Today/operating-plan `why` bodies for supplier delivery
schedules (EN / ES / zh-Hans) without rewriting durable English
`OperatingPlanItem.why`. Surface the localized why on open Today timeline rows.

## Changes

- `services/presentation/operatingPlanWhyCopy.ts` — `presentOperatingPlanWhy`
- `services/presentation/operationsPresentation.ts` — wire why presentation
- `components/operations/OperatingPlanTimeline.tsx` — show why on open rows
- `i18n/catalog.ts` — `today.plan.why` + `today.plan.whyBody.deliveryScheduled`
- `tests/operatingPlanWhyCopy.test.ts`

## Non-goals

- Rewriting durable domain English why strings
- Localizing freeform `recommendation.reason` (open #270)
- Daily Phase Brief interpretation embeds of why/effect (open #260; reuse helper later)
- Operating-plan effect bodies (open #275)

## Verification

- `npm run typecheck`
- `npm test -- tests/operatingPlanWhyCopy.test.ts`
- `npm test`
- `npm run security:static`
