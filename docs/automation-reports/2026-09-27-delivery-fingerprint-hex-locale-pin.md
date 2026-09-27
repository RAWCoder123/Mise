# MISE-005AM: delivery fingerprint hex locale pin

Date: 2026-09-27  
Branch: `cursor/mise-delivery-fingerprint-hex-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`private.supplier_email_deliveries.content_fingerprint` and
`authority_fingerprint` are validated only by bare POSIX class matches inside
the compound metadata CHECK:

```sql
content_fingerprint ~ '^[a-f0-9]{64}$'
authority_fingerprint ~ '^[a-f0-9]{64}$'
```

MISE-005A proved locale drift on this cluster. Sibling tips pinned OAuth
`state_hash` hex (#438) and approve-path fingerprint `lower()` (#432), but left
these durable claim-time columns on bare classes. Open #418/#424 rewrite the
same compound CHECK for claimed_* fields and intentionally keep fingerprint
hex bare — so a compound rewrite here would collide.

## Change

Additive dedicated CHECKs (nullable when unclaimed):

- `supplier_email_deliveries_content_fingerprint_hex_check`
- `supplier_email_deliveries_authority_fingerprint_hex_check`

each requiring `collate "C" ~ '^[a-f0-9]{64}$'` when non-null.

## Out of scope

- Compound `supplier_email_deliveries_mise_003c_metadata_check` (#418/#424)
- `approve_supplier_send_content` (#432)
- `service_complete_supplier_email_send` (#428)
- `provider_message_id` CHECKs (#444/#445)

## Compose

Alone on main OK (additive CHECKs; no function rewrite). Timestamp after
MISE-005AL (#446). Prefer after #418/#424 land so compound + additive pins
agree, but safe without them.

## Verification

- `npm run typecheck`
- focused `tests/deliveryFingerprintHexLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)
