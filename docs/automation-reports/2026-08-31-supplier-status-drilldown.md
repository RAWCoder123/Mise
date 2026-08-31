# Supplier status drill-down (2026-08-31)

## Summary

Expose existing supplier reliability evidence on a dedicated More-hub screen so
managers can review late, short, damaged, or unverified delivery patterns before
the next order — without burying that evidence only inside Daily Report.

## Changes

- Added `services/presentation/supplierStatusPresentation.ts` to partition
  attention vs stable suppliers and gate follow-up order CTAs.
- Added `/more/supplier-status` with fail-closed load/retry and restaurant-switch
  guards; reuses `fetchSupplierReliabilitySummary`.
- Linked the screen from More operations, Daily Report reliability action, and
  Daily Brief closing supplier follow-up route.
- Localized EN / ES / zh-Hans copy.

## Verification

- `npm run typecheck`
- `npm test` (includes `tests/supplierStatusPresentation.test.ts`)

## Notes

Read-only. Does not change ordering authority, supplier preference, or invent
delivery outcomes.
