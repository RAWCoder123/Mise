# MISE-005AAU: pin POS mappings choice-list menuItem.category to ASCII C

Date: 2026-11-09

## Summary

Pins POS mapping review choice-list radio meta `menuItem.category` to ASCII C
so Unicode-padded / Unicode-only-space free-form categories cannot invent a
clean category identity or bypass the intentional hide path with blank-looking
category copy under the menu-item name.

## Surface

- `app/settings/pos-mappings.tsx` expanded choice-list radio meta
- Helper: `services/domain/presentationPosMappingsChoiceListCategoryIdentity.ts`
- Soft-null → intentional hide (`choiceListCategory ? <Text>…</Text> : null`)

## Inventing / bypass proof

- Prior truthiness gate: `{menuItem.category ? <Text>{menuItem.category}</Text> : null}`
- `Boolean("\u2003") === true` previously still rendered blank-looking category meta
- `"\u2003Mains\u2003".trim() === "Mains"` inventing equality soft-nulled
- Soft-null restores intentional hide

## Leave alone

- POS mappings suggestedMenuItemName / selectedMenuItem.name (#1024 / MISE-005VP)
- Choice-list `menuItem.name` pass-through (still deferred beside #1024)
- Inventory detail subtitle category (#1189 / MISE-005AAD)
- Scan Item row meta category (#1190 / MISE-005AAE)
- Inventory categoryIcon classify (#701), setup POS category (#872), Square catalog category (#952)

## Alone-OK

Ordinary conflict only on `app/settings/pos-mappings.tsx` when #1024 lands.
No shared identity modules. No migration. No catalog keys (soft-null hides).

## Verification

- Focused `tests/posMappingsChoiceListCategoryAsciiC.test.ts` 5/5 (62 assertion call sites from source)
- `npm run typecheck` passed
- `npm test` 688 total / 681 pass / 0 fail / 7 cancelled (inherited withTimeout cancelledByParent; fixed in #1183, not landed)
- No migration

## Classification

Controlled pilot-ready integrity tip.
