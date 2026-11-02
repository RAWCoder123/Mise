# MISE-005WN Settings Gmail connectionSubtitle restaurant.name ASCII C (2026-11-02)

## Defect

Settings Gmail connection card used raw `restaurant.name` for the
connectionSubtitle Text:

```ts
<Text style={styles.connectionSubtitle}>{restaurant.name}</Text>
```

Unicode-only-space and empty string restaurant names still rendered a
blank-looking restaurant identity under the Restaurant Gmail card, so no
intentional localized fallback owned blank-looking restaurant identity for
that subtitle path. Unicode `.trim()` on padded restaurant names would invent
clean display restaurant identities before rendering them into the
connectionSubtitle.

## Fix

- `services/domain/presentationSettingsGmailRestaurantNameIdentity.ts`
- Soft-null via `normalizeSettingsGmailRestaurantName` (ASCII C single-line:
  ASCII end trim only; preserve NBSP — no fold; full C0/DEL reject) before the
  connectionSubtitle Text on `app/settings/gmail.tsx` (1 site). Soft-null names
  fall through to new localized `t("settings.gmail.connectionSubtitle.none")`
  (EN / ES / zh-Hans).

## Ownership

Owns only Settings Gmail connectionSubtitle `restaurant.name` presentation that
falls through to `settings.gmail.connectionSubtitle.none` when soft-null. Does
**not** own Settings Gmail sender_email display (#1019 / MISE-005VK), Orders
Gmail connected-body sender (#1020 / MISE-005VL), setup-readiness Gmail
sender_email (#1031 / MISE-005VW), Settings workspace item.name (#1047 /
MISE-005WM), Settings workspace cuisine_type (#1023 / MISE-005VO), Settings
profile restaurant name (#1021 / MISE-005VM), Sales Import hero restaurant name
(#1022 / MISE-005VN), Team Settings subtitle restaurant.name (#1046 /
MISE-005WL), Ask Mise greeting restaurant.name (#1045 / MISE-005WK), Home
greeting restaurant.name (#1044 / MISE-005WJ), Autonomy / Memory / Activity /
Support / Privacy / Count / Insights subtitle restaurant.name tips, Today
screen title restaurant-name (#968 / MISE-005UD), restaurant branding initials
(#967 / MISE-005UC), or Home ApprovalsSection card titles. Alone-OK relative to
those open tips and sibling candidates.

## Inventing / bypass proof

- Raw `"\u2003"` `restaurant.name` previously still rendered as the
  connectionSubtitle Text, with no localized none fallback
- Raw `""` `restaurant.name` same blank-subtitle bypass
- `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"` inventing equality
- ASCII C soft-null restores the localized
  `settings.gmail.connectionSubtitle.none` fallback for the connectionSubtitle
  Text

## Verification

- Focused `tests/settingsGmailRestaurantNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
