# MISE-005VD: Setup remove / a11y fallback labels ASCII C

Date: 2026-11-01  
Branch: `cursor/mise-setup-fallback-label-ascii-c`

## Problem

Auth setup-screen remove IconPress labels and related accessibility interpolations selected display tokens with raw truthiness:

```ts
item.name || t("setup.fallback.inventory")
supplier.name || t("setup.fallback.supplier")
recipe.dishName || t("setup.fallback.recipe")
ingredient.itemName || t("setup.fallback.ingredient")
```

A Unicode-only-space name (`"\u2003"`) is raw-truthy while `.trim()` empties it, so the intentional localized `setup.fallback.*` copy was bypassed and a11y chrome could speak a blank-looking token. Separately, Unicode `.trim()` on padded names would invent a clean display identity (`"\u2003Tomato\u2003".trim() === "Tomato"`).

## Change

- Add `services/domain/presentationSetupFallbackLabelIdentity.ts` with ASCII C single-line prep (ASCII end-trim only; refuse NBSP/em-space padding and ASCII controls).
- Route all seven `setup.fallback.*` interpolations in `app/(auth)/setup.tsx` through soft `normalizePresentationSetupFallbackLabel` so unsafe tokens fall through to the intentional localized fallback.
- Leave ChoiceChip supplier labels (#973), durable inventory item names (#903), setup-screen supplier identity (#696), durable supplierNames (#904), and inventory/recipe/ingredient validation labels alone.

## Inventing / bypass proof

- `Boolean("\u2003") === true` and `"\u2003" || "FALLBACK" !== "FALLBACK"` (fallback bypass).
- `"\u2003Tomato\u2003".trim() === "Tomato"` (Unicode-trim inventing).
- ASCII C soft-null restores `|| t("setup.fallback.*")`.

## Verification

- Focused `tests/presentationSetupFallbackLabelAsciiC.test.ts`
- `npm run typecheck`
- `npm test` (expect inherited recalculationCycles cancellations only)
