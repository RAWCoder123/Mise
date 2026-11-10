# MISE-005ABK: pin setup.ready.subtitle readyName to ASCII C

Date: 2026-11-10
Branch: `cursor/mise-setup-ready-subtitle-restaurant-ascii-c`

## Surface

Setup completion Screen subtitle:

```tsx
t("setup.ready.subtitle", { restaurant: readyName })
```

where `readyName` is set from the raw setup-form `restaurantName` after a
successful save via `setReadyName(restaurantName)`.

## Inventing proof

1. Setup emptiness / validation gates Unicode-trim
   (`restaurantName.trim()`), so Unicode-padded names such as
   `"\u2003Luna Bistro\u2003"` pass as non-empty while `setReadyName`
   still stores the padded form for the always-pass subtitle interpolate.
2. Unicode `.trim()` invents clean identity:
   `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"`.
3. Soft-null restores localized `setup.ready.subtitle.none` while durable
   restaurant-name write canonicalize (#844 / MISE-005PJ) and sibling Home /
   Ask Mise greeting restaurant-name tips stay untouched.

## Fix

- `services/domain/presentationSetupReadySubtitleRestaurantNameIdentity.ts` —
  ASCII C single-line normalize (end trim only; preserve NBSP; full C0/DEL
  reject)
- `app/(auth)/setup.tsx` — soft-null before
  `setupReadyRestaurantName ? t("setup.ready.subtitle", …) :
  t("setup.ready.subtitle.none")`
- `i18n/catalog.ts` — EN/ES/zh-Hans `setup.ready.subtitle.none`
- Focused inventing/bypass tests

## Ownership

Owns only setup ready Screen `{restaurant}` presentation for
`setup.ready.subtitle` → `setup.ready.subtitle.none`. Does **not** own
durable restaurant-name write canonicalize (#844 / MISE-005PJ), Home
greeting subtext restaurant.name (#1044 / MISE-005WJ), Ask Mise greeting
restaurant.name (#1045 / MISE-005WK), Today screen title restaurant-name
(#968 / MISE-005UD), or Autonomy / Memory / Activity / Support / Privacy /
Insights / Count subtitle restaurant.name tips.

## Verification

- Focused `tests/setupReadySubtitleRestaurantNameAsciiC.test.ts` 5/5
  (71 assertion call sites counted from source)
- `npm run typecheck` passed
- `npm test` — 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  `withTimeout cancelledByParent`; fixed in #1183, not landed)
- No migration
