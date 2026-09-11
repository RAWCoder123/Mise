# Inventory count hub fail-closed with draft preservation (2026-08-25)

## Summary

Inventory count sessions now fail closed on soft-refresh load errors without
discarding unsaved operator counts/notes, and mutation failures no longer lock
the hub as if the restaurant load failed.

## Changes

- Split `hubLoadError` from mutation `error` in `app/inventory/count.tsx`
- Gate session detail and draft/approve/cancel actions on `hubReady`
- Soft refresh invalidates readiness while in flight; load failure keeps local drafts
- Same-session soft-refresh success merges drafts via `mergeInventoryCountDraftMaps`
- Restaurant switch still clears drafts and session identity
- Pure helpers + unit pins in `services/domain/inventoryCountSessions.ts`

## Verification

- `npm run typecheck`
- Focused tests: `inventoryCountSessions`, `hubLoadState`, `clientTenantSafety`

## Notes

Supersedes the draft-clearing approach in open PR #152 for soft-refresh failure.
Does not overlap readiness UI PRs (#145–#151, #153–#154) or #130–#135.
