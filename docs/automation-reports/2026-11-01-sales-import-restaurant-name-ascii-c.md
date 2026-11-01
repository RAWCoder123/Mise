# MISE-005VN Sales Import hero restaurant name ASCII C (2026-11-01)

## Defect

Sales Import OperationalHero meta used:

```ts
restaurant?.name ?? t("common.notSet")
```

Unicode-only-space and empty string are non-nullish under `??`, bypassing
localized `common.notSet` copy. Unicode `.trim()` on padded restaurant names
would invent clean display restaurant identities.

## Fix

- `services/domain/presentationSalesImportRestaurantNameIdentity.ts`
- Soft-null via `normalizeSalesImportRestaurantName` (ASCII C single-line:
  ASCII end trim only; preserve NBSP — no fold; full C0/DEL reject) before
  `|| t("common.notSet")` on `app/settings/sales-import.tsx` (1 site)

## Ownership

Owns only Sales Import hero `common.notSet` restaurant-name presentation.
Does **not** own Settings hub restaurant-name (#1021), Insights profile
restaurant-name (#969), Today screen title restaurant-name (#968), branding
initials (#967), Settings account email (#966), Team directory labels (#965),
More/Settings profile name (#964), durable `requireRestaurantName` (#844),
workspace switcher `item.name` / `cuisine_type ?? metaFallback`, Orders
gmail connected-body sender (#1020), Settings/Gmail sender_email (#1019), or
Home ApprovalsSection card titles. Alone-OK relative to
#1021/#1020/#1019/#969/#968/#967/#966/#965/#964/#844.

## Inventing / bypass proof

- `("\u2003" ?? FALLBACK) === "\u2003"` bypasses `?? t("common.notSet")`
- `("" ?? FALLBACK) === ""` same bypass
- `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"` inventing equality
- ASCII C soft-null restores the localized notSet meta

## Verification

- Focused `tests/salesImportRestaurantNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test` (expect inherited recalculationCycles cancellations only)
