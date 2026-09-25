# Orphan PostgREST mutator removal

Date: 2026-09-25  
Branch: `cursor/mise-product-inspection-026f` @ `2bc50b8`  
Base: `origin/main` @ `78da737` (MISE-005A)

## Gap

Authenticated clients already hold SELECT-only grants on `inventory_items`,
`pos_sales`, `menu_item_ingredients`, `purchase_recommendations`, and
`setup_attachments`. Live product paths write through Edge/RPC
(`updateInventoryItemAndSignals`, `saveRecipeMappingAndSignals`, setup
snapshot, purchase recommendation RPCs).

The repository contract still exposed seven unused PostgREST mutators that
called `.from(...).(insert|update|upsert)` directly. Those methods could not
succeed under current grants, but they remained callable lying APIs and a
regression footgun if DML were ever re-granted.

## Fix

Removed from `repositoryContracts.ts`, `supabaseRepository.ts`, and
`demoRepository.ts`:

- `upsertInventoryItem`
- `createPosSale`
- `updateInventoryItem` (non-signal path)
- `updateMenuItemIngredientQuantity`
- `upsertMenuItemIngredient`
- `updatePurchaseRecommendation`
- `createSetupAttachment`

Pinned absence in `tests/security.test.ts` and updated the supplier-recipient
method delimiter in `tests/supplierRecipients.test.ts`.

No migration: grants and RLS were already correct.

## Verification

- `npm run typecheck`
- `npm test` — 677 passed, 0 failed (7 cancelled)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Focused: security + supplierRecipients 44/44
- `supabase:test` blocked (no Docker)

## Classification impact

Still **controlled pilot-ready code**. This closes a client-authority footgun;
it does not change hosted RLS, merge open stacks #348–#402, or unblock
App Store / TestFlight external steps.

## Next highest-impact (avoid open stacks)

1. Land/rebase open stacks onto main (#348–#402), especially security inventory,
   export PDE service-read, count-session export, and demo purchase_lines.
2. After #383+#365+#348: on-hand floor for usage / decreasing signed adjustments.
3. After #301+#366: DB-enforce waste/stockout reason allowlists.
4. Do not invent demo recipe/POS mapping stores or MOQ/lead_time/expiration.
