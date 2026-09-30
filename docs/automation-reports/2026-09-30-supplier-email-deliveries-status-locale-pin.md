# MISE-005DU: supplier_email_deliveries.status locale pin

**Date:** 2026-09-30  
**Branch:** `cursor/mise-supplier-email-deliveries-status-locale-pin`  
**Base:** `origin/main` @ `78da737` (+ open stacks through #532)

## Change

Replace the bare-IN `private.supplier_email_deliveries.status` CHECK with the
same exact-token allowlist plus ASCII shape under `COLLATE "C"`:

`sending` / `sent` / `failed` / `unknown`

## Scope

- CHECK-only additive migration `20260930350000_mise_005du_...`
- Does **not** rewrite Gmail OAuth/send edge writers or claim/complete RPCs
- Does **not** touch `supplier_email_deliveries_sent_check`, sender_email
  (#423), connection status (#500), or outreach_messages.status (#532)

## Why

MISE-005A proved locale drift on this cluster. A bare-IN delivery-status CHECK
can accept status bytes that a restored C-locale path would refuse (or the
reverse), breaking supplier-send delivery continuity across dump/restore.

## Verification

- `npm run typecheck` — pass
- Focused `supplierEmailDeliveriesStatusLocalePin` — 3/3 pass
- `npm test` — 679 pass / 0 fail / 7 cancelledByParent noise
- pgTAP plan **12** derived from **12** assertion call sites (Docker pgTAP
  not run in this environment)

## Files

- `supabase/migrations/20260930350000_mise_005du_supplier_email_deliveries_status_locale_pin.sql`
- `supabase/tests/database/supplier_email_deliveries_status_locale_pin.test.sql`
- `tests/supplierEmailDeliveriesStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-supplier-email-deliveries-status-locale-pin.md`
