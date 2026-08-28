# Post-setup supplier create (2026-08-28)

## Gap

`create_supplier` (owner/admin/manager), application `createSupplier`, and demo/hosted repository paths already existed after MISE-003C. Settings → Suppliers only supported rename + recipient email, so restaurants could not add a durable supplier after setup completed (setup itself rejects post-completion supplier discovery).

## Change

- Settings suppliers screen: manager-facing Add supplier form with hub fail-closed, stale-response guards, restaurant-switch draft clear, EN/ES/zh-Hans copy.
- Successful create inserts a directory row bound by durable `supplier_id` (no invented recipient).
- Does not send orders or invent inventory mappings.

## Proof

- Static pins in `tests/supplierRecipients.test.ts` for UI + guarded create path.
- Demo integration in `tests/demoSupplierIdentity.test.ts`.
- `npm run typecheck`, `npm test`, `npm run security:backend`, `npm run security:static` (recorded at tip).

## Out of scope

- Per-line putaway (blocked on order-line + station stacks).
- Landing/rebasing open PR stacks #130–#229 / #147.
- Live POS/Gmail, founder legal URLs, Apple/EAS.
