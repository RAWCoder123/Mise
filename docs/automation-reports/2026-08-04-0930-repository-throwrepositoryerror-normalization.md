# Automation report — Repository throwRepositoryError normalization

Date: 2026-08-04 ~09:30 UTC  
Branch: `cursor/mise-product-inspection-1fc0`

## Gap

Many hosted repository reads still used raw `throw error` / `throw *.error`, so RLS/permission failures did not notify tenant-authorization denial listeners and could not drive membership revalidation fail-closed.

## Fix

Normalized remaining restaurant-scoped read/write error paths in `services/repositories/miseRepository.ts` to `throwRepositoryError(..., restaurantId)`, including:

- planning sales RPC helper
- ops profile / restaurant data / planning parallel fetches
- inventory, storage, movements, count sessions
- recommendations, orders, insights, Gmail connection, POS status
- AI insight Edge invoke and export/account-deletion Edge errors

## Tests

- Extended `tests/clientTenantSafety.test.ts` to forbid residual `if (error) throw error` and pin key Result/linesError conversions.

## Remaining

- Docker/hosted security re-proof still required.
- Optional workspace-access StatusNotice after fail-closed clear.

## Classification

Still controlled pilot-ready pending Docker/hosted gates; not App Store submission-ready.
