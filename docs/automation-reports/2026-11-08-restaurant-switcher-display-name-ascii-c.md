# MISE-005ZN: pin RestaurantSwitcher chip display restaurant name to ASCII C

Date: 2026-11-08  
Branch: `cursor/mise-restaurant-switcher-display-name-ascii-c`  
Baseline: `origin/main` @ `78da7376` (MISE-005A)

## Surface

RestaurantSwitcher chip display Text under the Mise wordmark previously always
rendered raw `name`:

```tsx
<Text numberOfLines={1} style={styles.label}>{name}</Text>
```

## Inventing proof

- `Boolean("\u2003") === true` still rendered a blank-looking chip label.
- `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"` invents a clean restaurant
  identity if Unicode-trimmed before display.
- Soft-null restores intentional localized `screen.restaurantSwitcher.name.none`
  (EN Restaurant / ES Restaurante / zh-Hans 餐厅).

## Changes

- `services/domain/presentationRestaurantSwitcherDisplayNameIdentity.ts` —
  ASCII C single-line prep (end trim only; preserve NBSP; full C0/DEL)
- `components/ui/RestaurantSwitcher.tsx` — soft-null before chip label Text
- `i18n/catalog.ts` — `screen.restaurantSwitcher.name.none` EN/ES/zh-Hans
- `tests/restaurantSwitcherDisplayNameAsciiC.test.ts` — focused inventing proofs

## Leave alone

- #1079 RestaurantSwitcher a11y restaurant name (MISE-005XS)
- #1043 Autonomy subtitle restaurant.name
- #1044 Home greeting restaurant.name
- #1045 Ask Mise restaurant.name
- #968 Today screen title restaurant name
- No migration

## Verification

- focused RestaurantSwitcher display ASCII C 6/6 (64 assertion call sites from source)
- `npm run typecheck`: passed
- `npm run security:static` + `security:backend`: passed
- `npm run design:static`: passed
- `npm test`: 689 total / 682 pass / 0 fail / 7 cancelled (pre-existing recalculationCycles hung-timeout cancellations; unrelated)
