# MISE-005WM Settings workspace item.name ASCII C (2026-11-02)

## Defect

Settings workspace switcher used raw `item.name` for both the workspace name
Text and the accessibility restaurant interpolation:

```ts
accessibilityLabel={t(
  selected ? "settings.workspace.currentAccessibility" : "settings.workspace.switchAccessibility",
  { restaurant: item.name }
)}
// ...
<Text style={styles.workspaceName}>{item.name}</Text>
```

Unicode-only-space and empty string restaurant names still rendered a
blank-looking restaurant identity as the workspace name line and still
interpolated that blank token into the a11y templates, so the intentional
localized `settings.workspace.metaFallback` copy never owned blank-looking
restaurant identity for the name path. Unicode `.trim()` on padded restaurant
names would invent clean display restaurant identities before rendering them
into the workspace name Text or a11y label.

## Fix

- `services/domain/presentationSettingsWorkspaceRestaurantNameIdentity.ts`
- Soft-null via `normalizeSettingsWorkspaceRestaurantName` (ASCII C single-line:
  ASCII end trim only; preserve NBSP — no fold; full C0/DEL reject) before the
  workspace name Text and a11y restaurant token on `app/(tabs)/settings.tsx`
  (1 site). Soft-null names fall through to existing
  `t("settings.workspace.metaFallback")`.

## Ownership

Owns only Settings workspace switcher `item.name` presentation that falls
through to `settings.workspace.metaFallback` when soft-null. Does **not** own
Settings workspace cuisine_type (#1023 / MISE-005VO), Settings profile
restaurant name (#1021 / MISE-005VM), Sales Import hero restaurant name
(#1022 / MISE-005VN), Team Settings subtitle restaurant.name (#1046 /
MISE-005WL), Ask Mise greeting restaurant.name (#1045 / MISE-005WK), Home
greeting restaurant.name (#1044 / MISE-005WJ), Autonomy / Memory / Activity /
Support / Privacy / Count / Insights subtitle restaurant.name tips, Today
screen title restaurant-name (#968 / MISE-005UD), restaurant branding initials
(#967 / MISE-005UC), or Home ApprovalsSection card titles. Alone-OK relative to
those open tips and sibling candidates.

## Inventing / bypass proof

- Raw `"\u2003"` `item.name` previously still rendered as the workspace name
  Text and a11y restaurant token, skipping `settings.workspace.metaFallback`
- Raw `""` `item.name` same blank-name / blank-a11y bypass
- `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"` inventing equality
- ASCII C soft-null restores the localized `settings.workspace.metaFallback`
  fallback for both the name Text and a11y restaurant token

## Verification

- Focused `tests/settingsWorkspaceRestaurantNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
