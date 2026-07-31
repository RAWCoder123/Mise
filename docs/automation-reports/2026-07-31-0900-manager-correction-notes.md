# Manager correction notes + hosted DML footguns (2026-07-31)

## Problem
Single-item inventory edits already wrote `manager_correction` ledger rows, but managers could not explain why stock changed. Movement history also omitted metadata notes. Hosted repository methods still attempted direct `menu_item_ingredients` / `setup_attachments` DML that migrations revoke.

## Change
1. Optional correction note (≤240 chars) on inventory detail quantity saves.
2. Note stored in `inventory_movements.metadata.note` for `manager_correction` rows (SQL + demo).
3. Movement history surfaces notes for waste/corrections/etc.
4. Hosted `updateMenuItemIngredientQuantity`, `upsertMenuItemIngredient`, and `createSetupAttachment` now throw closed.

## Key paths
- `supabase/migrations/20260731090000_manager_correction_optional_note.sql`
- `supabase/functions/operational-workflows/index.ts`
- `services/domain/managerCorrection.ts`
- `services/application/inventory.ts`
- `services/repositories/miseRepository.ts`
- `app/inventory/[id].tsx`
- `tests/managerCorrectionNote.test.ts`

## Verification
- Unit/domain tests for note validation and metadata builder
- Security contract assertions for note migration + hosted DML throws
- pgTAP assertion for noted manager correction (local Docker when available)
