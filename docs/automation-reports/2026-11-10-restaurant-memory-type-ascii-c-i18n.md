# MISE-005ABT: localize Restaurant Memory memoryType under ASCII C

## Surface

`app/more/restaurant-memory.tsx` card type line previously always passed
`memory.memoryType.replace(/_/g, " ")` with no prep gate and no i18n.

## Inventing + UX proof

- Operators saw English machine humanize (`demand pattern`, `supplier reliability`).
- Unicode-only-space is truthy → blank-looking type chrome.
- `"\u2003demand_pattern\u2003".trim() === "demand_pattern"` invents a clean
  token before humanize.

## Fix

- `services/domain/presentationRestaurantMemoryTypeIdentity.ts`
- Allowlisted `RestaurantMemoryType` snake_case vocabulary → `memory.typeCode.*`
  MessageKeys (EN / ES / zh-Hans)
- Soft-null / unknown / unsafe → `memory.typeCode.unknown`
- ASCII C single-line end trim; preserve NBSP; full C0/DEL reject

## Left alone

- `memory.status` always-pass (deferred)
- statement / evidence.summary / correction draft / subtitle restaurant.name /
  scope/source sibling tips
- domain `convertMemoryToRule` title humanize

## Verification

- Focused `restaurantMemoryTypeAsciiC` tests
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm test`
