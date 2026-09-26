# MISE-005Q: supplier-send RPC email locale pin

Date: 2026-09-26  
Branch: `cursor/mise-supplier-send-rpc-email-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`private.build_supplier_send_content` (used by preview, approve, and claim)
still normalized From / To with bare `lower(btrim(...))`, bare `[[:cntrl:]]`,
and bare `[[:space:]]` mailbox shape, and subject with bare `[[:cntrl:]]`.
Those follow database `LC_CTYPE`. MISE-005A proved locale drift on this
cluster; sibling tips pinned CHECKs and upsert/OAuth/claimed-envelope paths
but left the send-content builder bare.

## Change

Additive migration
`20260926113000_mise_005q_supplier_send_rpc_email_locale_pin.sql` rewrites
`private.build_supplier_send_content` so From / To use C-locale lower +
cntrl + `[[:space:]]` mailbox shape, and subject uses C-locale cntrl.

Demo `services/domain/supplierSendContent.ts` mirrors the same ASCII C space
rejection and A-Z fold for local fingerprints.

## Out of scope

- Does not reattach `gmail_credentials` / `supplier_recipients` /
  `supplier_email_deliveries` CHECKs (MISE-005N / 005O / 005P).
- Does not rewrite `service_claim_supplier_email_send` credential identity
  compare (`lower(btrim(connection.sender_email))`) — leftover for a sibling tip.
- Does not rewrite `approve_supplier_send_content` body (it already calls build).

## Compose

Safe alongside MISE-005P (no shared CHECK reattach). Apply after MISE-003C.

## Verification

- `npm run typecheck`
- focused `tests/supplierSendRpcEmailLocalePin.test.ts`
- `npm test` (full suite)
- pgTAP fixture committed; not executed here (no Docker)
