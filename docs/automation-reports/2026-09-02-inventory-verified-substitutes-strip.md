# 2026-09-02 Inventory verified substitutes strip

Tip: `cursor/mise-inventory-verified-substitutes-strip`  
Base: `origin/cursor/mise-ingredient-substitutions-crud` @ `63a2329` (PR #337) on `origin/main` @ `20b28e5`

## Problem

Managers can verify ingredient substitution ratios (#337), but inventory detail did not show which active verified substitutes apply to the open item. Operators had to leave the item screen to discover emergency swap options.

## Solution

- Presentation helper `presentInventoryVerifiedSubstituteRows` filters to active verified source→substitute ratios only.
- Inventory detail loads `listVerifiedSubstitutesForInventoryItem` alongside outlook/queue, tenant-filters results, and fails soft to an empty advisory list without blocking the item workflow.
- When verified substitutes exist, a read-only card lists substitute names and ratios; managers can open Settings → Substitutions. No mutation path on this screen.
- EN / ES / zh-Hans catalog keys for the strip.

## Verification

- `npm run typecheck`
- `node --test --import tsx tests/inventoryVerifiedSubstitutesStrip.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

## Follow-ups

- Land #337 (and this tip) before consuming ratios in receive/depletion.
- Do not invent MOQ / lead_time / expiration columns.
