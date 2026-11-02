# MISE-005WK Ask Mise greeting restaurant.name ASCII C (2026-11-02)

## Defect

Ask Mise greeting body restaurant interpolation used:

```ts
t("ask.greeting.body", { restaurant: restaurant.name })
```

whenever a restaurant object existed past the early no-restaurant return.
Unicode-only-space and empty string restaurant names still interpolated a
blank-looking restaurant identity into `ask.greeting.body`. Unicode
`.trim()` on padded restaurant names would invent clean display restaurant
identities before interpolating into `ask.greeting.body`.

## Fix

- `services/domain/presentationAskMiseGreetingRestaurantNameIdentity.ts`
- Soft-null via `normalizeAskMiseGreetingRestaurantName` (ASCII C single-line:
  ASCII end trim only; preserve NBSP — no fold; full C0/DEL reject) before the
  restaurant-body branch on `app/ask-mise.tsx` (1 site). Soft-null names fall
  through to `t("ask.greeting.body.none")`.
- Added intentional localized `ask.greeting.body.none` copy in EN / ES /
  zh-Hans.

## Ownership

Owns only Ask Mise greeting `{restaurant}` presentation for
`ask.greeting.body` → `ask.greeting.body.none` fallback. Does **not** own Home
greeting restaurant.name (#1044 / MISE-005WJ), Autonomy subtitle restaurant.name
(#1043 / MISE-005WI), Restaurant Memory subtitle restaurant.name (#1042 /
MISE-005WH), Activity History subtitle restaurant.name (#1041 / MISE-005WG),
Support Settings subtitle restaurant.name (#1039 / MISE-005WE), Privacy Settings
subtitle restaurant.name (#1036 / MISE-005WD), Insights hub subtitle
restaurant.name (#1037 / MISE-005WC), Inventory Count subtitle restaurant.name
(#1040 / MISE-005WF), Settings profile restaurant name (#1021 / MISE-005VM),
Sales Import hero restaurant name (#1022 / MISE-005VN), Today screen title
restaurant-name (#968 / MISE-005UD), restaurant branding initials (#967 /
MISE-005UC), Settings workspace `item.name`, team subtitle restaurant.name, or
Home ApprovalsSection card titles. Alone-OK relative to those open tips and
sibling candidates.

## Inventing / bypass proof

- Restaurant object + `"\u2003"` name previously still chose
  `ask.greeting.body` and interpolated blank-looking identity
- Restaurant object + `""` name same blank interpolation
- `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"` inventing equality
- ASCII C soft-null restores the localized `ask.greeting.body.none` fallback

## Verification

- Focused `tests/askMiseGreetingRestaurantNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
