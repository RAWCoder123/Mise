# MISE-005X: approve send fingerprint locale pin

Date: 2026-09-26  
Branch: `cursor/mise-approve-send-fingerprint-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.approve_supplier_send_content` (the live supplier-send approval path
after `approve_supplier_send_envelope` EXECUTE was revoked in MISE-003B) still
folded the operator-reviewed content fingerprint with bare
`lower(btrim(...))`. `lower()` follows database `LC_CTYPE`. MISE-005A proved
locale drift on this cluster; MISE-005Q pinned the builder that produces the
fingerprint, but left approve itself on bare lower.

Under ctype drift, approve could refuse a fingerprint the operator reviewed
(or accept bytes that later diverge from the hex shape) — breaking
supplier-send approval continuity for the same reviewed bytes.

## Fix

Additive migration
`20260926180000_mise_005x_approve_send_fingerprint_locale_pin.sql` rewrites
`public.approve_supplier_send_content` so:

```sql
reviewed_fingerprint text := pg_catalog.lower(
  pg_catalog.btrim(coalesce(p_reviewed_content_fingerprint, '')) collate "C"
) collate "C";
```

EXECUTE remains revoked from public/anon/service_role; granted to
authenticated only.

## Out of scope

- Does not rewrite `private.build_supplier_send_content` (MISE-005Q)
- Does not rewrite claim / complete-send RPCs (MISE-005R/005T)
- Does not reattach envelope / Gmail CHECKs
- Does not revive revoked `approve_supplier_send_envelope`

## Compose

Prefer after MISE-005Q so builder + approve pins land together. Compose-safe
alone on main (`approve_supplier_send_content` unreplaced since 003c).
Timestamp after MISE-005W.

## Verification

- `npm run typecheck`
- focused `tests/approveSendFingerprintLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)
