# Recipes missing POS dish search (2026-08-29)

## Gap
Settings → Recipes builder only offered the first five unmapped POS dishes as chips (`slice(0, 5)`), so managers could not discover the rest without typing exact names. Today coverage repair remains a separate open stack.

## Change
- Domain: `services/domain/recipeMissingMenuSearch.ts` ranks and filters caller-supplied missing dish names; empty query returns the full deduped list.
- UI: when more than five dishes need recipes, the builder shows a find field, “showing X of Y”, and ranked chips with no hard five-chip cap. Five or fewer still show every chip.
- i18n: EN / ES / zh-Hans search labels and empty copy.

## Proof
- `npm run typecheck`
- `node --import tsx --test tests/recipeMissingMenuSearch.test.ts`
- `npm test`
- `npm run design:static` (when available)
- `npm run security:static` (when available)

## Out of scope
- Mapped-dish list uncap / search (#241)
- Theoretical food cost (#242)
- Inventory chip search (still capped at seven; separate slice)
- Today unmapped POS task (#188)
