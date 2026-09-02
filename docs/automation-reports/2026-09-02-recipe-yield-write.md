# Recipe yield write authority (2026-09-02)

## Summary

Managers can create, edit, verify, and retire restaurant-wide `recipe_versions`
yield factors (serving quantity, prep yield, cooking yield) without direct table
DML. Verified history is never rewritten in place — edits create or update draft
successors, and verify closes prior active windows.

Built on the #332 read-display tip so Settings → Recipes shows and edits yields
in one vertical slice.

## Surfaces

- Migration `20260902010000_recipe_version_yield_manager_authority.sql`
- Domain write helpers in `services/domain/recipeYield.ts`
- Application `services/application/recipeYield.ts`
- Demo mutable yield store + hosted RPC repository methods
- Settings Recipes editor (EN / ES / zh-Hans)
- Static + demo + pgTAP coverage

## Non-goals

- Location-specific yield editing
- Changing POS depletion math to consume yields (read/write authority only)
- Inventing MOQ / lead_time / expiration columns
