# MISE-005WJ Home greeting restaurant.name ASCII C (2026-11-02)

## Defect

Home greeting subtext restaurant interpolation used:

```ts
t("home.greeting.subtext", { restaurant: restaurant.name })
```

whenever a restaurant object existed past the early no-restaurant return.
Unicode-only-space and empty string restaurant names still interpolated a
blank-looking restaurant identity into `home.greeting.subtext`. Unicode
`.trim()` on padded restaurant names would invent clean display restaurant
identities before interpolating into `home.greeting.subtext`.

## Fix

- `services/domain/presentationHomeGreetingRestaurantNameIdentity.ts`
- Soft-null via `normalizeHomeGreetingRestaurantName` (ASCII C single-line:
  ASCII end trim only; preserve NBSP — no fold; full C0/DEL reject) before the
  restaurant-subtext branch on `app/(tabs)/home.tsx` (1 site). Soft-null names
  fall through to `t("home.greeting.subtext.none")`.
- Added intentional localized `home.greeting.subtext.none` copy in EN / ES /
  zh-Hans.

## Ownership

Owns only Home greeting `{restaurant}` presentation for
`home.greeting.subtext` → `home.greeting.subtext.none` fallback. Does **not**
own Autonomy subtitle restaurant.name (#1043 / MISE-005WI), Restaurant Memory
subtitle restaurant.name (#1042 / MISE-005WH), Activity History subtitle
restaurant.name (#1041 / MISE-005WG), Support Settings subtitle restaurant.name
(#1039 / MISE-005WE), Privacy Settings subtitle restaurant.name (#1036 /
MISE-005WD), Insights hub subtitle restaurant.name (#1037 / MISE-005WC),
Inventory Count subtitle restaurant.name (#1040 / MISE-005WF), Settings profile
restaurant name (#1021 / MISE-005VM), Sales Import hero restaurant name (#1022 /
MISE-005VN), Today screen title restaurant-name (#968 / MISE-005UD), restaurant
branding initials (#967 / MISE-005UC), Ask Mise restaurant.name (sibling tip
candidate), Settings workspace `item.name`, team subtitle restaurant.name, or
Home ApprovalsSection card titles. Alone-OK relative to those open tips and
sibling candidates.

## Inventing / bypass proof

- Restaurant object + `"\u2003"` name previously still chose
  `home.greeting.subtext` and interpolated blank-looking identity
- Restaurant object + `""` name same blank interpolation
- `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"` inventing equality
- ASCII C soft-null restores the localized `home.greeting.subtext.none` fallback

## Verification

- Focused `tests/homeGreetingRestaurantNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
