# MISE-005XS RestaurantSwitcher a11y restaurant.name ASCII C

Date: 2026-11-04

## Defect

`RestaurantSwitcher` always passed raw `name` into
`t("screen.openRestaurantSettings", { restaurant: name })`. Empty and
Unicode-only-space restaurant names are non-nullish and truthy, so VoiceOver /
TalkBack labels could include blank-looking restaurant identity with no
intentional localized none marker. Unicode `.trim()` on padded restaurant names
would invent a clean restaurant label.

## Fix

- Add `services/domain/presentationRestaurantSwitcherNameIdentity.ts`
  (`normalizeRestaurantSwitcherName`: ASCII end trim; soft-null Unicode
  padding / controls; preserve NBSP)
- Soft-null before RestaurantSwitcher a11y interpolation; fall through to
  `screen.openRestaurantSettings.none`
- Add EN / ES / zh-Hans `screen.openRestaurantSettings.none`
- Focused inventing / bypass proofs in `tests/restaurantSwitcherNameAsciiC.test.ts`

## Ownership

Owns only RestaurantSwitcher a11y **restaurant name → screen.openRestaurantSettings.none**.

Leaves chip display Text `{name}`, Autonomy subtitle restaurant.name (#1043),
Home greeting restaurant.name (#1044), Ask Mise restaurant.name (#1045), Today
screen title restaurant name (#968), and other tipped/sibling restaurant-name
fields alone.

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
