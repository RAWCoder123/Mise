# MISE-005AAE: pin Scan Item row meta category to ASCII C

Date: 2026-11-08

## Surface

`app/more/scan-item.tsx` OperationalRow subtitle via `t("scanItem.row.meta", { category, code })`.

Prior path always passed free-form `item.category` into the localized meta template.

## Inventing proof

- Free-form `inventory_items.category`
- Unicode-padded / Unicode-only-space invent blank-looking subtitle category via `.trim()` / always-pass
- `"\u2003Produce\u2003".trim() === "Produce"`
- `"\u2003"` / `""` → `"  · {code}"` / `" · {code}"`

## Fix

- Helper: `services/domain/presentationScanItemRowCategoryIdentity.ts`
- Soft-null → localized `scanItem.row.category.none` (EN Category / ES Categoría / ZH 类别)
- Single-line ASCII end trim; preserve NBSP; full C0/DEL rejection
- Soft-null when Unicode trim would still strip end padding

## Left alone

- Scan Item row item.item_name (#1061 / MISE-005XA)
- Inventory detail subtitle category (#1189 / MISE-005AAD)
- Inventory categoryIcon classify (#701 / MISE-005KF)
- setup POS itemName/category (#872 / MISE-005QL)
- Square catalog category (#952 / MISE-005TN)
- Scan Item search/filter haystack matching

## Verification

- Focused `tests/scanItemRowCategoryAsciiC.test.ts`
- `npm run typecheck`
- `npm test`
