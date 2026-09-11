# Suppliers soft-refresh draft preserve (2026-08-25)

Branch: `cursor/mise-suppliers-draft-preserve`  
Base: `origin/main` @ `6eedbfb`

## Problem

Settings → Suppliers reloaded the recipient directory on every focus. A successful soft refresh always reseeding `draftEmails` / `draftNames` from the server wiped unsaved display-name and order-email edits. Soft failures also left the screen without a clear fail-closed preserve path for retry.

## Fix

- Soft vs hard load via `hasLoadedRef` (restaurant switch hard-resets drafts).
- Soft refresh invalidates hub readiness in flight so rename/save stay closed until proof returns.
- Soft success updates directory rows but preserves operator-entered name/email drafts (seeds only new supplier keys).
- Soft failure sets `loadError` without clearing prior directory or drafts.
- Hard failure clears directory rows; restaurant switch clears drafts.

## Paths

- `app/settings/suppliers.tsx`
- `tests/hubLoadState.test.ts`
- `tests/clientTenantSafety.test.ts`
- `tests/supplierRecipients.test.ts`

## Verification

- `npm run typecheck`
- `npm test -- tests/hubLoadState.test.ts tests/clientTenantSafety.test.ts tests/supplierRecipients.test.ts`
