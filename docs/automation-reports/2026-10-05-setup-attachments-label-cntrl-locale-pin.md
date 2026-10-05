# MISE-005IJ: pin setup_attachments.label cntrl CHECK to COLLATE C

Date: 2026-10-05  
Branch: `cursor/mise-setup-attachments-label-cntrl-locale-pin`

## Summary

Reattached `public.setup_attachments_metadata_only_check` so the operator-visible
setup attachment `label` keeps the metadata-only storage contract, aligns with
the existing `save_restaurant_setup` writer bound (`length(trim(label))` between
1 and 240), and rejects ASCII control characters under `COLLATE "C"`.

Client write path now fails closed through `requireSetupAttachmentLabel` on the
same U+0000–U+001F / U+007F set before the hosted RPC round-trip.

## Why

Foundation only required `length(trim(label)) > 0` plus
`metadata.storage_status = metadata_only`. The setup RPC already refused labels
outside 1..240, but the table CHECK had no upper bound and no cntrl gate. Bare
POSIX `[[:cntrl:]]` follows database `LC_CTYPE`; MISE-005A proved locale drift
on this cluster. Dump/restore could therefore accept label bytes a restored
C-locale path would refuse (or the reverse), breaking setup-attachment
continuity.

## Scope

- CHECK-only migration
- Client write validator for setup attachment labels
- Does **not** rewrite `save_restaurant_setup`, kind/status vocabulary (#543),
  RLS, or pilot vocabulary pins

## Verification

- `npm run typecheck`
- focused `setupAttachmentsLabelCntrlLocalePin` tests
- `npm test`
- pgTAP plan derived from assertion call sites (Docker/hosted pgTAP may be
  unavailable in this environment)

## Alone-OK

Composes with open #543 (kind/status only; explicitly left
`setup_attachments_metadata_only_check` untouched).
