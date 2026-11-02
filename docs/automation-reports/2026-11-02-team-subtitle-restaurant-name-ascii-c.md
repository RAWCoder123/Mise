# MISE-005WL Team subtitle restaurant.name ASCII C (2026-11-02)

## Defect

Team Settings Screen subtitle used:

```ts
subtitle={restaurant ? restaurant.name : t("team.subtitle")}
```

whenever a restaurant object existed. Unicode-only-space and empty string
restaurant names still rendered a blank-looking restaurant identity as the
entire subtitle, bypassing the intentional localized `team.subtitle` copy.
Unicode `.trim()` on padded restaurant names would invent clean display
restaurant identities before rendering them as the Team subtitle.

## Fix

- `services/domain/presentationTeamSubtitleRestaurantNameIdentity.ts`
- Soft-null via `normalizeTeamSubtitleRestaurantName` (ASCII C single-line:
  ASCII end trim only; preserve NBSP — no fold; full C0/DEL reject) before the
  restaurant-subtitle branch on `app/settings/team.tsx` (1 site). Soft-null
  names fall through to existing `t("team.subtitle")`.

## Ownership

Owns only Team Settings Screen subtitle `restaurant.name` presentation that
falls through to `team.subtitle` when soft-null. Does **not** own Ask Mise
greeting restaurant.name (#1045 / MISE-005WK), Home greeting restaurant.name
(#1044 / MISE-005WJ), Autonomy subtitle restaurant.name (#1043 / MISE-005WI),
Restaurant Memory subtitle restaurant.name (#1042 / MISE-005WH), Activity
History subtitle restaurant.name (#1041 / MISE-005WG), Support Settings
subtitle restaurant.name (#1039 / MISE-005WE), Privacy Settings subtitle
restaurant.name (#1036 / MISE-005WD), Insights hub subtitle restaurant.name
(#1037 / MISE-005WC), Inventory Count subtitle restaurant.name (#1040 /
MISE-005WF), Settings profile restaurant name (#1021 / MISE-005VM), Sales
Import hero restaurant name (#1022 / MISE-005VN), Today screen title
restaurant-name (#968 / MISE-005UD), restaurant branding initials (#967 /
MISE-005UC), Settings workspace `item.name`, or Home ApprovalsSection card
titles. Alone-OK relative to those open tips and sibling candidates.

## Inventing / bypass proof

- Restaurant object + `"\u2003"` name previously still chose `restaurant.name`
  as the subtitle and skipped `team.subtitle`
- Restaurant object + `""` name same blank subtitle bypass
- `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"` inventing equality
- ASCII C soft-null restores the localized `team.subtitle` fallback

## Verification

- Focused `tests/teamSubtitleRestaurantNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
