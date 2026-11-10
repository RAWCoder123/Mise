# MISE-005ABX: pin convertMemoryToRule title under ASCII C

Date: 2026-11-10
Branch: `cursor/mise-convert-memory-to-rule-title-ascii-c`
Baseline: `origin/main` @ `78da7376`

## Surface

Domain `convertMemoryToRule` previously always-passed raw `memory.memoryType`
into the operator-facing rule-draft title with only underscore→space humanize:

```text
title: memory.memoryType.replace(/_/g, " ")
```

Open #1230 / MISE-005ABT explicitly left this domain title humanize alone while
localizing Restaurant Memory hub `memory.memoryType` chrome.

## Change

- Added `services/domain/restaurantMemoryRuleTitleIdentity.ts`
- Wired `convertMemoryToRule` draft title through
  `normalizeRestaurantMemoryRuleTitleType` with `"unknown"` soft-null
  fallthrough and allowlisted `RestaurantMemoryType` vocabulary
- Underscore→space humanize remains a post-normalize step on the safe token
  only
- Soft-null Unicode-padded / control-bearing / empty / unknown tokens restore
  readable `"unknown"` title copy instead of blank-looking or invented draft
  identity

## Left alone

- Restaurant Memory hub memoryType localization (#1230 / MISE-005ABT)
- Restaurant Memory hub memory.status localization (#1231 / MISE-005ABU)
- Restaurant Memory statement (#830), correction draft (#848),
  evidence.summary (#1154), subtitle restaurant.name (#1042), scope/source
  (#841)
- Autonomy actionType / evidence.type leave-alone
- Activity recalculation cycle humanize (#1233 / MISE-005ABW)

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered blank-looking title
  identity (`" "`)
- `"\u2003demand_pattern\u2003".trim() === "demand_pattern"` inventing equality
- Unknown machine tokens such as `invented_token` must not invent
  underscore-humanized titles
- ASCII C soft-null restores the intentional `"unknown"` fallthrough

## Verification

- Focused `tests/restaurantMemoryRuleTitleAsciiC.test.ts` 5/5
  (67 assertion call sites counted from source)
- `npm run typecheck` — pass
- `npm run security:static` — pass
- `npm run security:backend` — pass
- `npm run design:static` — pass
- `npm test` — 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  withTimeout cancelledByParent; open #1183)
- No migration. Alone-OK beside #1230 / #1231 (ordinary conflict only if those
  tips later touch `restaurantMemory.ts`; this tip owns domain title humanize
  + new identity module only).
