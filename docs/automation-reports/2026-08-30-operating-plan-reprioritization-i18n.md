# Operating plan reprioritization i18n (2026-08-30)

## Scope

Fix Today operating-plan reprioritization copy so ES / zh-Hans operators no
longer see durable English `reason` strings, and surface the localized urgency
line on open timeline rows.

## Bug

`presentOperatingPlanItem` called
`copy.reprioritization[code](item.reprioritization.reason)`. Templates were
`(detail) => detail || localizedFallback`, so a non-empty English audit reason
always won and ES/zh-Hans never rendered.

## Changes

- Domain: optional `deliveryDate` on delivery-scoped reprioritization codes
- Presentation: localize by code (+ delivery date); never prefer English reason
- Today timeline: show `reprioritizationReason` on open rows
- Tests: presentation freeze pin, timeline surface pin, deliveryDate domain pins

## Non-goals

- Localizing freeform `why` / `effect` (#275 / #276)
- Rewriting durable English `reason` audit strings
- Daily Brief finding wrappers that embed why/effect
- Home activity-window / watching chrome (#210 / #211 / #274)

## Verification

- `npm run typecheck`
- `node --test --import tsx tests/operationsPresentation.test.ts tests/operatingPlan.test.ts`
- `npm test`
- `npm run security:static`
