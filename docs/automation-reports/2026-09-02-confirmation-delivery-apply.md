# Apply supplier confirmation delivery dates (2026-09-02)

## Summary
Managers can apply an acknowledged/changed supplier confirmation's
`expected_delivery_at` onto a **sent** order's `delivery_date` so Home/Today
overdue and receive planning stop using a stale promised date.

## Why
`#336` records confirmations (including reschedules) but does not write the
confirmed date onto `supplier_orders`. `#294` only edits draft dates;
`update_supplier_order_draft` rejects sent orders.

## Implementation
- Domain helpers: propose/select apply candidates; refuse cross-tenant, non-sent,
  rejected/unverified, missing/invalid timestamps, and already-applied dates.
- Additive RPC `apply_supplier_confirmation_delivery_date` (owner/admin/manager,
  `auth.uid()`), restaurant-timezone calendar conversion, activity + audit evidence.
- Demo seed confirmation on the default sent Pantry order; demo/hosted repository
  parity; Orders detail CTA when a candidate exists.
- EN / ES / zh-Hans copy.

## Verification
- `npm run typecheck`
- `npm test` (targeted confirmation apply suites + full suite)
- `npm run security:static`
- `npm run design:static`

## Notes
- Hosted tenants need the additive migration deployed before the apply RPC works.
- Recording confirmations remains `#336` / service-role integration path; this tip
  only applies dates from existing confirmation evidence.
