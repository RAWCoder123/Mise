# MISE-005BT: pin supplier-send version CHECKs to COLLATE C

Date: 2026-09-28
Branch: `cursor/mise-supplier-send-version-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Additive dedicated CHECKs on `private.supplier_email_deliveries`:

- `supplier_email_deliveries_content_version_check`
- `supplier_email_deliveries_authority_version_check`

each requiring nullable-or-shape under COLLATE `"C"`:

```sql
col is null or col collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint:

- `mise.supplier_send.v1` / `mise.supplier_send.v2` (content_version)
- `mise.purchase_authority.v1` (authority_version)

from MISE-003B/003C claim-time builders. Compound metadata CHECK still owns
the exact allowlist; this tip only pins ASCII shape under COLLATE C.

## Why

Compound metadata CHECK uses bare allowlist equality without a dedicated
COLLATE C shape gate. MISE-005A proved locale drift on this cluster. Sibling
tips pinned fingerprint hex (#447), last_error_code (#450), rfc_message_id
(#418), and provider_message_id (#444) on this table; version identity
columns remained unbound.

## Scope

- CHECK-only; does **not** rewrite
  `supplier_email_deliveries_mise_003c_metadata_check` (#418/#424)
- Does **not** rewrite claim / approve / complete RPCs
- Does **not** touch fingerprint hex (#447), last_error_code (#450), or
  provider_message_id (#444/#445)
- Alone on main OK; timestamp after #479 (`20260928190000`)

## Verification

- `npm run typecheck`
- focused `tests/supplierSendVersionLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260928190000_mise_005bt_supplier_send_version_locale_pin.sql`
- `supabase/tests/database/supplier_send_version_locale_pin.test.sql`
- `tests/supplierSendVersionLocalePin.test.ts`
- `docs/automation-reports/2026-09-28-supplier-send-version-locale-pin.md`
