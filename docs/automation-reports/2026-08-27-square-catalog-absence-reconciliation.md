# Square catalog absence reconciliation

Date: 2026-08-27  
Branch tip: pending commit on `cursor/mise-product-inspection-4d8a`  
Baseline: `origin/main` @ `20b28e5`

## Problem

Full Square catalog sync only upserted present catalog rows. Deleted or inactive
Square items remained as current `pos_catalog_item_mappings` (`effective_to` null)
and `menu_items.active = true`, so planning could keep treating ghost dishes as
mapped coverage and continue depletion chains after the merchant removed them.

## Change

Additive migration `20260827010000_square_catalog_absence_reconciliation.sql`:

- After a successful **full** scoped Square apply, reconcile absence against the
  catalog snapshot.
- Soft-close absent current mappings on this integration's locations:
  `effective_to = now()`, `verification_status = 'expired'`.
- Deactivate orphan menu items that no longer have any current mapping.
- Never delete mappings, menu items, sales, or recipe history.
- Partial webhook snapshots do not reconcile (cannot mass-expire from incomplete
  authority windows).
- Bounded counts land on sales import + sync audit metadata.

## Evidence

- Source contract tests: `tests/squareCatalogAbsenceReconciliation.test.ts`
- pgTAP: `supabase/tests/database/square_catalog_absence_reconciliation.test.sql`
- Gap audit catalog row moved from UNSAFE → PARTIAL for this slice

## Remaining

- Operator UI for draft mapping review
- Hosted proof of a live Square catalog deletion sync
- Stack awareness: PR #130 rewrites related apply paths and should rebase onto
  this additive wrapper rather than reintroducing forever-live absent mappings
